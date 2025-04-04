from rest_framework import viewsets
from .models import Conversation
from .serializers import ConversationSerializer

class ConversationViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows conversations to be viewed or edited.
    """
    queryset = Conversation.objects.all().order_by('-created_at') # Get all, newest first
    serializer_class = ConversationSerializer
    # Add permission classes later if needed (e.g., IsAuthenticated)
    # permission_classes = [] 