from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin # Avoid name clash
from django.contrib.auth import get_user_model
from .models import Conversation

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
    # Add fields related to user to fieldsets if you want to edit them here (usually not needed)
    fieldsets = (
        (None, {'fields': ('name', 'user', 'audio_file', 'duration')}),
        ('Status', {'fields': ('status_transcription', 'status_recap', 'status_summary', 'status_analysis', 'status_coaching')}),
        ('Content', {'fields': ('transcription_text', 'recap_text', 'summary_data', 'analysis_results', 'coaching_feedback')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    ) 