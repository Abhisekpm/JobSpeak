from django.db import models
from django.utils import timezone
import os

# Define a dynamic path for uploaded audio files
def conversation_audio_path(instance, filename):
    # File will be uploaded to MEDIA_ROOT/conversations/<id>/<filename>
    return f'conversations/{instance.id}/{filename}'

class Conversation(models.Model):
    # Transcription Status Choices
    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    TRANSCRIPTION_STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_FAILED, 'Failed'),
    ]

    # Add Status choices for Recap and Summary (similar structure)
    STATUS_RECAP_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_FAILED, 'Failed'),
    ]

    STATUS_SUMMARY_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_FAILED, 'Failed'),
    ]

    name = models.CharField(max_length=255, blank=True, default='Untitled Conversation')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Status field can be expanded later (e.g., 'processing', 'transcribed', 'analyzed')
    status = models.CharField(max_length=50, default='created')
    # Add audio file field
    audio_file = models.FileField(upload_to=conversation_audio_path, null=True, blank=True)
    # Add duration field (in seconds)
    duration = models.PositiveIntegerField(null=True, blank=True, help_text="Duration of the audio in seconds")

    # Phase 3 Fields
    status_transcription = models.CharField(
        max_length=20,
        choices=TRANSCRIPTION_STATUS_CHOICES,
        default=STATUS_PENDING
    )
    transcription_text = models.TextField(blank=True, null=True)
    # analysis_results = models.JSONField(null=True, blank=True, help_text="Results of the analysis") # Removed for now
    # status_analysis = models.CharField(max_length=50, default='none') # Removed for now

    # Recap fields
    status_recap = models.CharField(
        max_length=20,
        choices=STATUS_RECAP_CHOICES,
        default=STATUS_PENDING
    )
    recap_text = models.TextField(null=True, blank=True) # To store the summarized text

    # Summary fields
    status_summary = models.CharField(
        max_length=20,
        choices=STATUS_SUMMARY_CHOICES,
        default=STATUS_PENDING
    )
    summary_data = models.JSONField(
        null=True,
        blank=True,
        default=dict,
        help_text="JSON object containing short, balanced, and detailed summaries"
    )

    def __str__(self):
        return f"Conversation {self.id} - {self.name} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"

    @property
    def status_transcription_display(self):
        return self.get_status_transcription_display()

    @property
    def status_recap_display(self):
        return self.get_status_recap_display()

    @property
    def status_summary_display(self):
        return self.get_status_summary_display()

    # Override save method to ensure directory exists (optional but good practice)
    # def save(self, *args, **kwargs):
    #     if self.pk is None: # Only on creation before file is saved
    #         saved = super().save(*args, **kwargs)
    #         # Now self.id is available, ensure directory exists *before* file save attempt
    #         if self.audio_file:
    #             dir_path = os.path.dirname(self.audio_file.path)
    #             os.makedirs(dir_path, exist_ok=True)
    #         return saved
    #     else:
    #         return super().save(*args, **kwargs) 