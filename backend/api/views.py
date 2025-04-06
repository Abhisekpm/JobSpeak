from rest_framework import viewsets
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Conversation
from .serializers import ConversationSerializer

# Import Django's default storage
from django.core.files.storage import default_storage

# Import the Celery task
from .tasks import process_transcription_task

class ConversationViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows conversations to be viewed or edited.
    Handles file uploads (audio_file) via multipart/form-data.
    Ensures associated audio file is deleted when a conversation is deleted.
    """
    queryset = Conversation.objects.all().order_by('-created_at') # Get all, newest first
    serializer_class = ConversationSerializer
    parser_classes = (MultiPartParser, FormParser) # Add parsers for file uploads
    # Add permission classes later if needed (e.g., IsAuthenticated)
    # permission_classes = [] 

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
        # Check if there is an associated audio file
        if instance.audio_file:
            # Get the path/name relative to the storage
            file_name = instance.audio_file.name
            # Delete the file using the storage backend
            # Use `save=False` because we are about to delete the model instance anyway
            instance.audio_file.delete(save=False)
            print(f"Deleted associated audio file: {file_name}") # Optional logging
        
        # Now, proceed with deleting the model instance from the database
        super().perform_destroy(instance)

    # If you need custom logic on create/update (e.g., extracting duration
    # from the uploaded file), you might override perform_create or perform_update.
    # Example:
    # def perform_create(self, serializer):
    #     instance = serializer.save()
    #     # Add logic here to process instance.audio_file if needed
    #     # instance.duration = calculate_duration(instance.audio_file)
    #     # instance.save() 