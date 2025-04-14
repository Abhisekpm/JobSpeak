from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin # Avoid name clash
from django.contrib.auth import get_user_model
from .models import Conversation, UserProfile

User = get_user_model()

# Register the standard User model with the default UserAdmin
# Unregister the default User admin first if it was registered elsewhere
try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass 
admin.site.register(User, BaseUserAdmin)

# Register the Conversation model
@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'user', 'created_at', 'status_transcription', 'status_recap', 'status_summary', 'status_analysis', 'status_coaching')
    list_filter = ('user', 'status_transcription', 'status_recap', 'status_summary', 'status_analysis', 'status_coaching', 'created_at')
    search_fields = ('name', 'user__username', 'user__email', 'id')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        (None, {'fields': ('name', 'user', 'audio_file', 'duration')}),
        ('Status', {'fields': ('status_transcription', 'status_recap', 'status_summary', 'status_analysis', 'status_coaching')}),
        ('Content', {'fields': ('transcription_text', 'recap_text', 'summary_data', 'analysis_results', 'coaching_feedback')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    ) 

# Register the UserProfile model
@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Admin view for UserProfile."""
    list_display = ('user', 'resume', 'has_job_description') # Show user, resume file, and if JD exists
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('user',)
    
    @admin.display(boolean=True, description='Job Description Uploaded')
    def has_job_description(self, obj):
        """Custom method to display whether a job description file exists."""
        return bool(obj.job_description)

    # Customize fieldsets to show resume and job description
    fieldsets = (
        (None, {'fields': ('user',)}),
        ('User Files', {'fields': ('resume', 'job_description')}),
    ) 