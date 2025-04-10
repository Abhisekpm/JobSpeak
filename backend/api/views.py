from rest_framework import viewsets, status, permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Conversation
from .serializers import ConversationSerializer, UserSerializer, ConversationCreateSerializer
from .permissions import IsOwner
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
    API endpoint that allows conversations to be viewed or edited by the owner.
    Handles file uploads (audio_file) via multipart/form-data.
    Ensures associated audio file is deleted when a conversation is deleted.
    Filters results based on the authenticated user.
    """
    # Add a default queryset for the router, get_queryset will override for requests
    queryset = Conversation.objects.none() 
    serializer_class = ConversationSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    # Apply IsOwner permission in get_object if needed, or rely on queryset filtering

    def get_queryset(self):
        """Filter conversations to only those owned by the requesting user."""
        user = self.request.user
        if user.is_authenticated:
            return Conversation.objects.filter(user=user).order_by('-created_at')
        # Return an empty queryset if user is not authenticated (though IsAuthenticated should prevent this)
        return Conversation.objects.none()

    def get_serializer_class(self):
        """Use ConversationCreateSerializer for create action."""
        if self.action == 'create':
            return ConversationCreateSerializer
        return ConversationSerializer

    def perform_create(self, serializer):
        """Save instance, associate user, and then enqueue transcription task."""
        # Associate the logged-in user with the new conversation
        instance = serializer.save(user=self.request.user)
        print(f"Saved new Conversation with ID: {instance.id} for user: {self.request.user.username}")

        if instance.audio_file:
            print(f"Scheduling background transcription task for Conversation ID: {instance.id}")
            process_transcription_task(instance.id)
        else:
            print(f"No audio file uploaded for Conversation ID: {instance.id}. Transcription not triggered.")
            instance.status_transcription = Conversation.STATUS_FAILED
            # Add other downstream statuses to failed if needed
            instance.status_recap = Conversation.STATUS_FAILED
            instance.status_summary = Conversation.STATUS_FAILED
            instance.status_analysis = Conversation.STATUS_FAILED
            instance.status_coaching = Conversation.STATUS_FAILED
            instance.save(update_fields=[
                'status_transcription', 
                'status_recap', 
                'status_summary',
                'status_analysis',
                'status_coaching',
                'updated_at'
            ])

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