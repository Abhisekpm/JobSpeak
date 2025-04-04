from django.db import models

class Conversation(models.Model):
    name = models.CharField(max_length=255, blank=True, default='Untitled Conversation')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Status field can be expanded later (e.g., 'processing', 'transcribed', 'analyzed')
    status = models.CharField(max_length=50, default='created')

    def __str__(self):
        return f"Conversation {self.id} - {self.name} ({self.created_at.strftime('%Y-%m-%d %H:%M')})" 