from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Conversation, UserProfile, Interview  # Remove Message import
from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage # Ensure imported

User = get_user_model()

class ConversationSerializer(serializers.ModelSerializer):
    # Make audio_file read-only in list/detail views, handle upload separately
    # Use SerializerMethodField to construct the full URL for audio_file
    audio_file_url = serializers.SerializerMethodField()
    status_transcription_display = serializers.CharField(source='get_status_transcription_display', read_only=True)
    status_recap_display = serializers.CharField(source='get_status_recap_display', read_only=True)
    status_summary_display = serializers.CharField(source='get_status_summary_display', read_only=True)
    status_analysis_display = serializers.CharField(source='get_status_analysis_display', read_only=True)
    status_coaching_display = serializers.CharField(source='get_status_coaching_display', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Conversation
        fields = [
            'id',
            'user',
            'username',
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
            'status_summary',
            'status_summary_display',
            'summary_data',
            'status_analysis',
            'status_analysis_display',
            'analysis_results',
            'status_coaching',
            'status_coaching_display',
            'coaching_feedback',
        ]
        read_only_fields = [
            'id',
            'user',
            'username',
            'created_at',
            'updated_at',
            'audio_file_url',
            'status_transcription',
            'status_transcription_display',
            'transcription_text',
            'status_recap',
            'status_recap_display',
            'recap_text',
            'status_summary',
            'status_summary_display',
            'summary_data',
            'status_analysis',
            'status_analysis_display',
            'analysis_results',
            'status_coaching',
            'status_coaching_display',
            'coaching_feedback',
        ]

    def get_audio_file_url(self, obj):
        # Revert to simple URL property access
        # Assumes the URL is publicly accessible due to S3 bucket policy
        if obj.audio_file and hasattr(obj.audio_file, 'url'):
            try:
                # Just return the direct S3 URL
                return obj.audio_file.url
            except Exception as e:
                print(f"ERROR generating S3 URL for {obj.audio_file.name}: {e}")
                return None
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

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password')
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': True},
            'username': {'required': True},
        }
    
    def create(self, validated_data):
        try:
            user = User.objects.create_user(
                username=validated_data['username'],
                email=validated_data['email'],
                password=validated_data['password']
            )
            return user
        except Exception as e:
            # Log any errors during user creation
            print(f"Error creating user: {str(e)}")
            raise serializers.ValidationError(str(e))

# --- UserProfile Serializer ---
class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for the UserProfile model.
    Allows updating resume and job_description files.
    """
    # Define fields explicitly to control read/write behavior
    resume = serializers.FileField(required=False, allow_null=True, use_url=True)
    job_description = serializers.FileField(required=False, allow_null=True, use_url=True)
    # Read-only field for the username, useful for context
    username = serializers.CharField(source='user.username', read_only=True)
    # Add the new field for generated questions
    generated_mock_questions = serializers.JSONField(read_only=True, required=False, allow_null=True)

    class Meta:
        model = UserProfile
        fields = [
            'user', 
            'username', 
            'resume', 
            'job_description',
            'generated_mock_questions' # Add to fields list
        ]
        read_only_fields = ['user', 'username'] # User should not be changed here

    def update(self, instance, validated_data):
        """Update UserProfile, handling file uploads manually to S3."""
        
        storage = S3Boto3Storage() # Instantiate S3 storage
        updated_fields = []

        # Handle resume file
        resume_file = validated_data.get('resume') # Use .get() to handle absence safely
        if 'resume' in validated_data: # Check if the field was explicitly sent
            updated_fields.append('resume')
            # Get the old file path before potentially changing it
            old_resume_path = instance.resume.name if instance.resume else None
            
            if resume_file: # A new file was uploaded
                new_resume_path = instance.resume.field.generate_filename(instance, resume_file.name)
                try:
                    saved_resume_path = storage.save(new_resume_path, resume_file)
                    instance.resume.name = saved_resume_path 
                except Exception as e:
                    print(f"ERROR: Failed to manually save resume to S3: {e}")
                    raise serializers.ValidationError({"resume": f"Failed to upload file: {e}"})
                
                if old_resume_path and old_resume_path != saved_resume_path:
                    storage.delete(old_resume_path)
                    
            else: # resume field was sent as null or empty - clear the field
                if old_resume_path:
                    storage.delete(old_resume_path)
                instance.resume = None

        # Handle job_description file similarly
        jd_file = validated_data.get('job_description')
        if 'job_description' in validated_data:
            updated_fields.append('job_description')
            old_jd_path = instance.job_description.name if instance.job_description else None

            if jd_file:
                new_jd_path = instance.job_description.field.generate_filename(instance, jd_file.name)
                try:
                    saved_jd_path = storage.save(new_jd_path, jd_file)
                    instance.job_description.name = saved_jd_path
                except Exception as e:
                    print(f"ERROR: Failed to manually save job description to S3: {e}")
                    raise serializers.ValidationError({"job_description": f"Failed to upload file: {e}"})
                    
                if old_jd_path and old_jd_path != saved_jd_path:
                    storage.delete(old_jd_path)
            else:
                if old_jd_path:
                    storage.delete(old_jd_path)
                instance.job_description = None

        # Save only the updated fields to the database
        if updated_fields:
             instance.save(update_fields=updated_fields)

        return instance

# --- Interview Serializers ---
class InterviewSerializer(serializers.ModelSerializer):
    # audio_file_url = serializers.SerializerMethodField() # No longer needed if we don't have a single primary audio file
    status_transcription_display = serializers.CharField(source='get_status_transcription_display', read_only=True)
    status_analysis_display = serializers.CharField(source='get_status_analysis_display', read_only=True)
    status_coaching_display = serializers.CharField(source='get_status_coaching_display', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    # answer_audio_s3_keys could be exposed if needed for client, e.g., for playing back individual answers
    # For now, keeping it backend-internal primarily for processing tasks.
    # If needed, add: answer_audio_s3_keys = serializers.JSONField(read_only=True)

    class Meta:
        model = Interview
        fields = [
            'id',
            'user',
            'username',
            'name',
            'created_at',
            'updated_at',
            'questions_used',
            # 'audio_file', # Removed
            # 'audio_file_url', # Removed
            # 'duration', # Removed
            'answer_audio_s3_keys', # Added, make read-only or remove if not for client
            'status_transcription',
            'status_transcription_display',
            'transcription_text', # This might store combined transcript or first one. Or be removed if using a new field for list of transcripts
            'status_analysis',
            'status_analysis_display',
            'analysis_results',
            'status_coaching',
            'status_coaching_display',
            'coaching_feedback',
        ]
        read_only_fields = [
            'id',
            'user',
            'username',
            'created_at',
            'updated_at',
            # 'audio_file_url', # Removed
            'answer_audio_s3_keys', # Make read-only
            'status_transcription',
            'status_transcription_display',
            'transcription_text',
            'status_analysis',
            'status_analysis_display',
            'analysis_results',
            'status_coaching',
            'status_coaching_display',
            'coaching_feedback',
        ]

    # def get_audio_file_url(self, obj): # Removed
    #     if obj.audio_file and hasattr(obj.audio_file, 'url'):
    #         try:
    #             return obj.audio_file.url
    #         except Exception as e:
    #             print(f"ERROR generating S3 URL for Interview {obj.id} audio file {obj.audio_file.name}: {e}")
    #             return None
    #     return None

class InterviewCreateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    questions_used = serializers.JSONField(required=True)
    # user = serializers.PrimaryKeyRelatedField(read_only=True) # Option 1: Make it read-only if present
    # Option 2: Or ensure it's not a writable field the client can send, and rely on view to inject

    class Meta:
        model = Interview
        fields = ['id', 'name', 'questions_used'] # 'user' is not included here for client input
        read_only_fields = ['id']

    def create(self, validated_data):
        # user is automatically passed into validated_data by serializer.save(user=request.user) in the view
        user = validated_data.pop('user') 
        name = validated_data.pop('name', None)
        questions_used = validated_data.pop('questions_used')
        
        if not name:
            existing_count = Interview.objects.filter(user=user).count()
            name = f"Mock Interview {existing_count + 1}"

        # validated_data should now be empty or contain any other fields you might add to Meta.fields later
        interview = Interview.objects.create(
            user=user,
            name=name,
            questions_used=questions_used,
            **validated_data
        )
        return interview