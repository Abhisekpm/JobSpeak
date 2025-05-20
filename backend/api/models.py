from django.db import models
from django.utils import timezone
import os
from django.conf import settings # Import settings to get AUTH_USER_MODEL

# Define a dynamic path for uploaded conversation audio files
def conversation_audio_path(instance, filename):
    # File will be uploaded to MEDIA_ROOT/conversations/<user_id>/<convo_id>/<filename>
    user_id_folder = instance.user.id if instance.user else 'anonymous'
    return f'conversations/{user_id_folder}/{instance.id}/{filename}'

# Define a dynamic path for uploaded resume files
def resume_upload_path(instance, filename):
    # File will be uploaded to MEDIA_ROOT/resumes/<user_id>/<filename>
    # instance is UserProfile, so access user via instance.user
    user_id_folder = instance.user.id if instance.user else 'anonymous'
    # Include a timestamp or unique identifier to prevent overwrites if user uploads multiple resumes with the same name
    timestamp = timezone.now().strftime("%Y%m%d%H%M%S")
    base, ext = os.path.splitext(filename)
    # Sanitize filename slightly (optional, consider a more robust library if needed)
    safe_base = "".join(c for c in base if c.isalnum() or c in ('_', '-')).rstrip()
    safe_filename = f"{safe_base}_{timestamp}{ext}"
    final_path = f'resumes/{user_id_folder}/{safe_filename}'
    return final_path

# Define a dynamic path for uploaded job description files
def job_description_upload_path(instance, filename):
    # File will be uploaded to MEDIA_ROOT/job_descriptions/<user_id>/<filename>
    user_id_folder = instance.user.id if instance.user else 'anonymous'
    timestamp = timezone.now().strftime("%Y%m%d%H%M%S")
    base, ext = os.path.splitext(filename)
    safe_base = "".join(c for c in base if c.isalnum() or c in ('_', '-')).rstrip()
    safe_filename = f"{safe_base}_{timestamp}{ext}"
    final_path = f'job_descriptions/{user_id_folder}/{safe_filename}'
    return final_path

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

# --- User Profile Model ---
class UserProfile(models.Model):
    """
    Stores additional user-specific information, like resume and job description files.
    Linked one-to-one with the main User model.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        primary_key=True, # Makes the User the primary key for the profile
        related_name='userprofile' # Allows access via user.userprofile
    )
    resume = models.FileField(
        upload_to=resume_upload_path,
        null=True,
        blank=True,
        help_text="User's uploaded resume file (PDF, DOCX, etc.)."
    )
    job_description = models.FileField( # Changed from TextField
        upload_to=job_description_upload_path, # Added upload_to
        null=True,
        blank=True,
        help_text="Uploaded job description file (PDF, DOCX, etc.)." # Updated help_text
    )
    generated_mock_questions = models.JSONField(
        null=True,
        blank=True,
        help_text="Generated mock interview questions based on resume and JD (stored as a list of strings)."
    )

    def __str__(self):
        return f"Profile for {self.user.username}"

# Check the existing models

# Define a dynamic path for uploaded interview audio files
def interview_audio_path(instance, filename):
    # File will be uploaded to MEDIA_ROOT/interviews/<user_id>/<interview_id>/<filename>
    user_id_folder = instance.user.id if instance.user else 'anonymous'
    # Sanitize filename (optional, but good practice if filename comes from user input directly for the object name)
    # For now, assuming filename is reasonable or handled by S3 storage if special chars exist.
    return f'interviews/{user_id_folder}/{instance.id}/{filename}'


class Interview(models.Model):
    # --- Status Definitions (can reuse from Conversation or define specifically if they diverge) ---
    STATUS_PENDING = Conversation.STATUS_PENDING
    STATUS_PROCESSING = Conversation.STATUS_PROCESSING
    STATUS_COMPLETED = Conversation.STATUS_COMPLETED
    STATUS_FAILED = Conversation.STATUS_FAILED
    
    STATUS_CHOICES = Conversation.STATUS_CHOICES

    # --- Core Fields ---
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='interviews',
        null=False,
        blank=False
    )
    name = models.CharField(max_length=255, blank=True, default='Untitled Interview')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    questions_used = models.JSONField(null=True, blank=True, help_text="List of questions asked during this interview.")
    audio_file = models.FileField(upload_to=interview_audio_path, null=True, blank=True)
    duration = models.PositiveIntegerField(null=True, blank=True, help_text="Duration of the audio in seconds")

    # --- Transcription Fields ---
    status_transcription = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING
    )
    transcription_text = models.JSONField(null=True, blank=True, help_text="Raw transcription result (JSON)")

    # --- Analysis Fields ---
    status_analysis = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING
    )
    analysis_results = models.JSONField(null=True, blank=True, default=dict, help_text="JSON object for interview analysis")

    # --- Coaching Fields ---
    status_coaching = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING
    )
    coaching_feedback = models.TextField(null=True, blank=True, help_text="Generated coaching feedback for the interview")

    # --- String Representation ---
    def __str__(self):
        user_info = self.user.username if self.user else 'No User'
        return f"Interview {self.id} by {user_info} - {self.name} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"

    # --- Status Display Properties ---
    @property
    def status_transcription_display(self):
        return self.get_status_transcription_display()

    @property
    def status_analysis_display(self):
        return self.get_status_analysis_display()
    
    @property
    def status_coaching_display(self):
        return self.get_status_coaching_display()