from django.db import models
from django.utils import timezone
import os
from django.conf import settings # Import settings to get AUTH_USER_MODEL

# Define a dynamic path for uploaded audio files
def conversation_audio_path(instance, filename):
    # File will be uploaded to MEDIA_ROOT/conversations/<user_id>/<convo_id>/<filename>
    # Ensure instance.user_id exists when this is called (usually after initial save if user is set)
    user_id_folder = instance.user.id if instance.user else 'anonymous'
    return f'conversations/{user_id_folder}/{instance.id}/{filename}'

class Conversation(models.Model):
    # --- Status Definitions ---
    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    
    # Generic choices tuple (can be reused)
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_FAILED, 'Failed'),
    ]

    # --- Core Fields ---
    # Link to the user who owns this conversation
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE, # Delete conversations if user is deleted
        related_name='conversations',
        null=False, # Must be associated with a user
        blank=False
    )
    name = models.CharField(max_length=255, blank=True, default='Untitled Conversation')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(max_length=50, default='created') # Legacy/overall status, maybe remove later?
    audio_file = models.FileField(upload_to=conversation_audio_path, null=True, blank=True)
    duration = models.PositiveIntegerField(null=True, blank=True, help_text="Duration of the audio in seconds")

    # --- Transcription Fields ---
    status_transcription = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING
    )
    # Store transcription as JSON directly from Deepgram for flexibility
    transcription_text = models.JSONField(null=True, blank=True, help_text="Raw transcription result (JSON)")

    # --- Recap Fields ---
    status_recap = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING
    )
    recap_text = models.TextField(null=True, blank=True, help_text="Generated dialog-style recap")

    # --- Summary Fields ---
    status_summary = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING
    )
    summary_data = models.JSONField(
        null=True,
        blank=True,
        default=dict,
        help_text="JSON object containing short, balanced, and detailed summaries"
    )

    # --- NEW: Analysis Fields ---
    status_analysis = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING
    )
    analysis_results = models.JSONField(
        null=True,
        blank=True,
        default=dict, # Use dict for default empty JSON
        help_text="JSON object containing talk_time_ratio, sentiment, and topics"
    )

    # --- NEW: Coaching Fields ---
    status_coaching = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING
    )
    coaching_feedback = models.TextField(
        null=True,
        blank=True,
        help_text="Generated coaching feedback text"
    )

    # --- String Representation ---
    def __str__(self):
        user_info = self.user.username if self.user else 'No User'
        return f"Conversation {self.id} by {user_info} - {self.name} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"

    # --- Status Display Properties ---
    @property
    def status_transcription_display(self):
        return self.get_status_transcription_display()

    @property
    def status_recap_display(self):
        return self.get_status_recap_display()

    @property
    def status_summary_display(self):
        return self.get_status_summary_display()

    @property
    def status_analysis_display(self):
        """Returns the display name for the analysis status."""
        return self.get_status_analysis_display()
    
    @property
    def status_coaching_display(self):
        """Returns the display name for the coaching status."""
        return self.get_status_coaching_display()

    # Override save method (optional but can be useful)
    # def save(self, *args, **kwargs):
    #     # Add logic if needed
    #     super().save(*args, **kwargs)
# Check the existing models