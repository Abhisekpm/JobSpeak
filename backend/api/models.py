from django.db import models

# Define a dynamic path for uploaded audio files
def conversation_audio_path(instance, filename):
    # File will be uploaded to MEDIA_ROOT/conversations/<id>/<filename>
    return f'conversations/{instance.id}/{filename}'

class Conversation(models.Model):
    name = models.CharField(max_length=255, blank=True, default='Untitled Conversation')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Status field can be expanded later (e.g., 'processing', 'transcribed', 'analyzed')
    status = models.CharField(max_length=50, default='created')
    # Add audio file field
    audio_file = models.FileField(upload_to=conversation_audio_path, null=True, blank=True)
    # Add duration field (in seconds)
    duration = models.PositiveIntegerField(null=True, blank=True, help_text="Duration of the audio in seconds")

    def __str__(self):
        return f"Conversation {self.id} - {self.name} ({self.created_at.strftime('%Y-%m-%d %H:%M')})" 