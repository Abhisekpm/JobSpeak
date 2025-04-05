from rest_framework import viewsets
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Conversation
from .serializers import ConversationSerializer

class ConversationViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows conversations to be viewed or edited.
    Handles file uploads (audio_file) via multipart/form-data.
    """
    queryset = Conversation.objects.all().order_by('-created_at') # Get all, newest first
    serializer_class = ConversationSerializer
    parser_classes = (MultiPartParser, FormParser) # Add parsers for file uploads
    # Add permission classes later if needed (e.g., IsAuthenticated)
    # permission_classes = [] 

    # If you need custom logic on create/update (e.g., extracting duration
    # from the uploaded file), you might override perform_create or perform_update.
    # Example:
    # def perform_create(self, serializer):
    #     instance = serializer.save()
    #     # Add logic here to process instance.audio_file if needed
    #     # instance.duration = calculate_duration(instance.audio_file)
    #     # instance.save() 