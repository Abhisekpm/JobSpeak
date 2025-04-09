from rest_framework import viewsets, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Conversation
from .serializers import ConversationSerializer, UserSerializer
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from .tasks import process_transcription_task

User = get_user_model()

# Add user registration view
@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    # Log the incoming data
    print(f"Registration request data: {request.data}")
    
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    # Print validation errors
    print(f"Registration validation errors: {serializer.errors}")
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Add user detail view
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_details(request):
    print(f"User details requested for: {request.user.username}")
    serializer = UserSerializer(request.user)
    return Response(serializer.data)

# Modify conversation views to use authentication
class ConversationViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows conversations to be viewed or edited.
    Handles file uploads (audio_file) via multipart/form-data.
    Ensures associated audio file is deleted when a conversation is deleted.
    """
    queryset = Conversation.objects.all().order_by('-created_at') # Get all, newest first
    serializer_class = ConversationSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser) # Add parsers for file uploads and JSON
    permission_classes = [IsAuthenticated]  # Add permission class
    
    def get_queryset(self):
        # Filter conversations by current user
        return Conversation.objects.all()  # For now, return all - in a real app, filter by user

    # Override perform_create to enqueue transcription task
    def perform_create(self, serializer):
        """Save instance and then enqueue transcription task if audio exists."""
        instance = serializer.save()
        print(f"Saved new Conversation with ID: {instance.id}")

        if instance.audio_file:
            print(f"Scheduling background transcription task for Conversation ID: {instance.id}")
            # Schedule the task using django-background-tasks
            process_transcription_task(instance.id) # Just call the function
            # Note: Status is initially PENDING by model default
        else:
            print(f"No audio file uploaded for Conversation ID: {instance.id}. Transcription not triggered.")
            instance.status_transcription = Conversation.STATUS_FAILED
            instance.save(update_fields=['status_transcription'])

    # Override destroy to delete the associated audio file
    def perform_destroy(self, instance):
        try:
            # Check if there is an associated audio file
            if instance.audio_file:
                # Get the path/name relative to the storage
                file_name = instance.audio_file.name
                try:
                    # Delete the file using the storage backend
                    # Use `save=False` because we are about to delete the model instance anyway
                    instance.audio_file.delete(save=False)
                    print(f"Deleted associated audio file: {file_name}") # Optional logging
                except Exception as e:
                    print(f"Warning: Could not delete audio file {file_name}: {str(e)}")
                    # Continue with deletion even if file deletion fails
                    # This ensures the database record is still deleted
        
            # Now, proceed with deleting the model instance from the database
            super().perform_destroy(instance)
        except Exception as e:
            print(f"Error during conversation deletion: {str(e)}")
            raise

    # If you need custom logic on create/update (e.g., extracting duration
    # from the uploaded file), you might override perform_create or perform_update.
    # Example:
    # def perform_create(self, serializer):
    #     instance = serializer.save()
    #     # Add logic here to process instance.audio_file if needed
    #     # instance.duration = calculate_duration(instance.audio_file)
    #     # instance.save()