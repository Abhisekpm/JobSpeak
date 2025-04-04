from rest_framework import serializers
from .models import Conversation

class ConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conversation
        # Include all fields for now, can be refined later
        fields = '__all__'
        # Make some fields read-only as they are set automatically
        read_only_fields = ('id', 'created_at', 'updated_at') 