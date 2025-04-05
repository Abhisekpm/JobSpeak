from rest_framework import serializers
from .models import Conversation

class ConversationSerializer(serializers.ModelSerializer):
    # Add display fields for choice fields to show human-readable status
    status_transcription_display = serializers.CharField(source='get_status_transcription_display', read_only=True)
    
    class Meta:
        model = Conversation
        # Include all fields including new transcription fields
        fields = (
            'id',
            'name',
            'created_at',
            'updated_at',
            'status',
            'audio_file',
            'duration',
            'status_transcription',
            'status_transcription_display', # Include the display field
            'transcription_text',
        )
        # Add new fields to read_only_fields
        read_only_fields = (
            'id', 
            'created_at', 
            'updated_at',
            'status_transcription',
            'status_transcription_display',
            'transcription_text',
        ) 