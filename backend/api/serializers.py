from rest_framework import serializers
from .models import Conversation

class ConversationSerializer(serializers.ModelSerializer):
    # Make audio_file read-only in list/detail views, handle upload separately
    # Use SerializerMethodField to construct the full URL for audio_file
    audio_file_url = serializers.SerializerMethodField()
    status_transcription_display = serializers.CharField(source='get_status_transcription_display', read_only=True)
    status_recap_display = serializers.CharField(source='get_status_recap_display', read_only=True)

    class Meta:
        model = Conversation
        fields = [
            'id',
            'name',
            'created_at',
            'updated_at',
            'status',
            'audio_file',
            'audio_file_url',
            'duration',
            'status_transcription',
            'status_transcription_display',
            'transcription_text',
            'status_recap',
            'status_recap_display',
            'recap_text',
        ]
        read_only_fields = [
            'id', 
            'created_at', 
            'updated_at', 
            'audio_file_url', 
            'status_transcription', 
            'status_transcription_display',
            'transcription_text',
            'status_recap',
            'status_recap_display',
            'recap_text',
        ]

    def get_audio_file_url(self, obj):
        request = self.context.get('request')
        if obj.audio_file and request:
            # Use build_absolute_uri to get the full URL including domain
            return request.build_absolute_uri(obj.audio_file.url)
        return None

class ConversationCreateSerializer(serializers.ModelSerializer):
    # Allow writing to audio_file during creation/upload
    audio_file = serializers.FileField(write_only=True, required=True)
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    # Add duration field, making it writable and required
    duration = serializers.FloatField(required=True, write_only=True) 

    class Meta:
        model = Conversation
        # Add duration to the fields list
        fields = ['id', 'name', 'audio_file', 'duration'] 
        read_only_fields = ['id']

    def create(self, validated_data):
        # Pop name and duration to handle them explicitly
        name = validated_data.pop('name', None)
        duration = validated_data.pop('duration', None) # Get duration

        if not name:
             # Create a default name if none provided
             existing_count = Conversation.objects.count()
             name = f"Conversation {existing_count + 1}"
        
        # Pass name and duration explicitly to create
        conversation = Conversation.objects.create(
            name=name, 
            duration=duration, 
            **validated_data # Pass remaining data (audio_file)
        )
        return conversation 