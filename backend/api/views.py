from rest_framework import viewsets, status, permissions, generics
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from .models import Conversation, UserProfile, Interview
from .serializers import ConversationSerializer, UserSerializer, ConversationCreateSerializer, UserProfileSerializer, InterviewSerializer, InterviewCreateSerializer
from .permissions import IsOwner
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from .tasks import process_transcription_task, process_interview_transcription_task
from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from rest_framework_simplejwt.tokens import RefreshToken
from django.shortcuts import get_object_or_404
import boto3
from botocore.exceptions import ClientError
import os
import traceback
from .services.mock_interview import extract_text_from_file, generate_mock_questions, extract_text_from_url, extract_company_name

# Imports for Deepgram TTS
from django.http import StreamingHttpResponse
from deepgram import DeepgramClient, SpeakOptions # Make sure SpeakOptions is imported
from django.conf import settings # To access DEEPGRAM_API_KEY if stored in settings

# ADDED: Logger for views, similar to tasks.py
import logging
task_logger = logging.getLogger('background_tasks') # Using the same logger name as in tasks.py for consistency, or choose a new one like 'api_views'
# END ADDED

User = get_user_model()

# Add user registration view
@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    # Log the incoming data
    print(f"Registration request data: {request.data}")
    
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    # Print validation errors
    print(f"Registration validation errors: {serializer.errors}")
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Add user detail view
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_details(request):
    print(f"User details requested for: {request.user.username}")
    serializer = UserSerializer(request.user)
    return Response(serializer.data)

# Modify conversation views to use authentication
class ConversationViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows conversations to be viewed or edited by the owner.
    Handles file uploads (audio_file) via multipart/form-data.
    Ensures associated audio file is deleted when a conversation is deleted.
    Filters results based on the authenticated user.
    """
    # Add a default queryset for the router, get_queryset will override for requests
    queryset = Conversation.objects.none() 
    serializer_class = ConversationSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    # Apply IsOwner permission in get_object if needed, or rely on queryset filtering

    def get_queryset(self):
        """Filter conversations to only those owned by the requesting user."""
        user = self.request.user
        if user.is_authenticated:
            return Conversation.objects.filter(user=user).order_by('-created_at')
        # Return an empty queryset if user is not authenticated (though IsAuthenticated should prevent this)
        return Conversation.objects.none()

    def get_serializer_class(self):
        """Use ConversationCreateSerializer for create action."""
        if self.action == 'create':
            return ConversationCreateSerializer
        return ConversationSerializer

    def perform_create(self, serializer):
        """Manually handle file save to force S3 storage (WORKAROUND)."""
        # 1. Separate file data from other data
        audio_file_data = serializer.validated_data.pop('audio_file', None)
        user = self.request.user

        # 2. Save the instance WITHOUT the file first to get an ID
        instance = serializer.save(user=user)
        # print(f"Saved initial Conversation with ID: {instance.id} for user: {user.username}")

        # 3. Manually save the file using S3 storage if it exists
        if audio_file_data:
            # print(f"Attempting to save audio file explicitly using S3Boto3Storage instance...")
            try:
                s3_storage = S3Boto3Storage()
                # Manually generate the filename/key using the field's upload_to logic
                file_name = instance.audio_file.field.generate_filename(instance, audio_file_data.name)
                
                # Use the storage instance's save method directly
                actual_name_saved = s3_storage.save(file_name, audio_file_data)
                
                # Check if save returned the expected name 
                if actual_name_saved:
                    # print(f"Successfully saved audio file to S3 with key: {actual_name_saved}")
                    # Manually assign the saved file path/key to the model instance field
                    instance.audio_file.name = actual_name_saved
                    # Save *only* the audio_file field back to the database
                    instance.save(update_fields=['audio_file'])
                    # print(f"Updated instance {instance.id} audio_file field in DB.")
                else:
                     raise ValueError("S3 save failed to return name.") # Treat as error

            except Exception as e:
                 print(f"ERROR explicitly saving audio file to S3 for instance {instance.id}: {e}") # Keep error log
                 # Clean up: delete the instance if S3 upload failed
                 instance.delete()
                 raise # Re-raise the exception to return a server error to the client
        
        # 4. Trigger background task (only if file was successfully processed and saved)
        if instance.audio_file and instance.audio_file.name: 
            print(f"Scheduling background transcription task for Conversation ID: {instance.id}")
            process_transcription_task(instance.id)
        elif not audio_file_data:
            # Handle case where no file was uploaded at all
            print(f"No audio file uploaded for Conversation ID: {instance.id}. Transcription not triggered.")
            instance.status_transcription = Conversation.STATUS_FAILED
            instance.status_recap = Conversation.STATUS_FAILED
            instance.status_summary = Conversation.STATUS_FAILED
            instance.status_analysis = Conversation.STATUS_FAILED
            instance.status_coaching = Conversation.STATUS_FAILED
            instance.save(update_fields=['status_transcription', 'status_recap', 'status_summary', 'status_analysis', 'status_coaching', 'updated_at'])
        
        # Do NOT call super().perform_create(serializer)

    # Override destroy to delete the associated audio file
    def perform_destroy(self, instance):
        # Get the file name *before* deleting the instance
        audio_file_name = None
        if instance.audio_file and instance.audio_file.name:
            audio_file_name = instance.audio_file.name
            print(f"DEBUG: Found audio file name to potentially delete from S3: {audio_file_name}")

        # Proceed with deleting the database record first
        try:
            super().perform_destroy(instance)
            print(f"Successfully deleted Conversation DB record with ID: {instance.id}")
        except Exception as db_exc:
            print(f"ERROR deleting Conversation DB record {instance.id}: {db_exc}")
            # Decide if you want to stop here or still attempt S3 deletion
            raise # Re-raise the DB error

        # If DB deletion was successful AND we had a file name, try deleting from S3
        if audio_file_name:
            print(f"Attempting to delete file from S3: {audio_file_name}")
            try:
                # Explicitly use S3Boto3Storage to delete
                s3_storage = S3Boto3Storage()
                s3_storage.delete(audio_file_name)
                print(f"Successfully deleted file from S3: {audio_file_name}")
            except Exception as s3_exc:
                # Log the error but don't crash the request, as DB record is already gone
                print(f"ERROR deleting file from S3 {audio_file_name}: {s3_exc}. DB record was already deleted.")
        else:
            print(f"No associated audio file name found for deleted Conversation ID: {instance.id}. No S3 deletion attempted.")

    # If you need custom logic on create/update (e.g., extracting duration
    # from the uploaded file), you might override perform_create or perform_update.
    # Example:
    # def perform_create(self, serializer):
    #     instance = serializer.save()
    #     # Add logic here to process instance.audio_file if needed
    #     # instance.duration = calculate_duration(instance.audio_file)
    #     # instance.save()

# --- Google Authentication View ---
@api_view(['POST'])
@permission_classes([AllowAny]) # Allow anyone to attempt Google login
def google_login_callback(request):
    """
    Receives Google ID token from frontend, verifies it,
    finds or creates a user, and returns JWT tokens.
    """
    google_token = request.data.get('access_token') # Token sent from frontend
    if not google_token:
        return Response({'error': 'Google token not provided.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Verify the token with Google
        idinfo = id_token.verify_oauth2_token(
            google_token, 
            google_requests.Request(), 
            settings.GOOGLE_CLIENT_ID 
        )

        email = idinfo.get('email')
        first_name = idinfo.get('given_name')
        last_name = idinfo.get('family_name')

        if not email:
            return Response({'error': 'Email not found in Google token.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            username = email
            if User.objects.filter(username=username).exists():
                print(f"ERROR: Username '{username}' derived from email already exists.")
                return Response({'error': f'An account with the username {username} already exists. Please log in normally or contact support.'}, status=status.HTTP_400_BAD_REQUEST)
                
            user = User.objects.create_user(
                username=username, 
                email=email,
                first_name=first_name or '',
                last_name=last_name or '',
                password=None 
            )

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        return Response({
            'access': access_token,
            'refresh': refresh_token,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email
            }
        }, status=status.HTTP_200_OK)

    except ValueError as e:
        print(f"ERROR: Google token verification failed: {e}")
        return Response({'error': f'Invalid Google token: {e}'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        print(f"ERROR: An unexpected error occurred during Google login: {e}")
        return Response({'error': 'An unexpected error occurred.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --- End Google Authentication View ---

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def generate_audio_download_url(request, pk):
    """
    Generate a pre-signed URL for downloading the audio file from S3.
    Handles potential discrepancies between DB path and actual S3 key.
    """
    try:
        conversation = get_object_or_404(Conversation, pk=pk)

        if conversation.user != request.user:
            return Response(
                {"error": "Permission denied"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if not conversation.audio_file:
            return Response(
                {"error": "No audio file available"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get the base name stored in the database
        db_file_name = conversation.audio_file.name
        print(f"DEBUG: DB file name: {db_file_name}")
        
        # Determine the correct S3 key based on current settings
        # Use current settings' DEFAULT_FILE_STORAGE to decide the expected structure
        current_storage_is_s3 = settings.DEFAULT_FILE_STORAGE == 'storages.backends.s3boto3.S3Boto3Storage'
        aws_location = getattr(settings, 'AWS_LOCATION', None)
        
        s3_file_key = db_file_name
        if current_storage_is_s3 and aws_location:
            # If S3 is active AND an AWS_LOCATION is set, the actual S3 key
            # should typically include the location prefix.
            # We assume the db_file_name does NOT already include it.
            expected_prefix = f"{aws_location}/"
            if not db_file_name.startswith(expected_prefix):
                s3_file_key = f"{expected_prefix}{db_file_name}"
                print(f"DEBUG: Prepended AWS_LOCATION. Using key: {s3_file_key}")
            else:
                 print(f"DEBUG: DB name already includes location. Using key: {s3_file_key}")
        else:
            print(f"DEBUG: Not prepending location (S3 not default or no location set). Using key: {s3_file_key}")

        # Initialize S3 client
        s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME
        )
        
        # Check if the derived key exists
        try:
            s3_client.head_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=s3_file_key
            )
            print(f"DEBUG: Confirmed file exists in S3 bucket at key: {s3_file_key}")
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                print(f"ERROR: Derived key '{s3_file_key}' does not exist in S3 bucket '{settings.AWS_STORAGE_BUCKET_NAME}'")
                # Optionally, list objects here again if needed for further debugging
                return Response(
                    {"error": "The audio file could not be found in storage. It might have been moved or deleted, or the storage path is incorrect."}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            else:
                # Re-raise other S3 client errors
                raise

        # Get the file extension for the correct Content-Type
        base_filename = os.path.basename(db_file_name) # Use original base name for download filename
        file_extension = base_filename.split('.')[-1].lower() if '.' in base_filename else 'mp3'
        
        content_type_map = {
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'm4a': 'audio/mp4',
            'ogg': 'audio/ogg',
            'flac': 'audio/flac'
        }
        content_type = content_type_map.get(file_extension, 'audio/mpeg')
        download_filename = f"{conversation.name or 'audio'}.{file_extension}"
        
        # Generate a pre-signed URL for the S3 object
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                'Key': s3_file_key,
                'ResponseContentType': content_type,
                'ResponseContentDisposition': f'attachment; filename="{download_filename}"',
            },
            ExpiresIn=3600
        )
        
        print(f"DEBUG: Generated presigned URL (truncated): {presigned_url[:100]}...")
        return Response({"download_url": presigned_url})
    
    except ClientError as e:
        error_code = e.response['Error']['Code'] if 'Error' in e.response else 'Unknown'
        error_message = e.response['Error']['Message'] if 'Error' in e.response else str(e)
        print(f"ERROR: AWS S3 ClientError: Code={error_code}, Message={error_message}")
        return Response(
            {"error": f"Failed to generate download URL due to S3 error: {error_message}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    except Exception as e:
        print(f"ERROR: Unexpected error in generate_audio_download_url: {str(e)}")
        print(traceback.format_exc())
        return Response(
            {"error": "An unexpected server error occurred while processing your request."}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# --- UserProfile View ---
class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    API endpoint for retrieving and updating the authenticated user's profile.
    Handles file uploads for resume and job_description.
    """
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser] 

    def get_object(self):
        # Ensure UserProfile is created if it doesn't exist for the logged-in user
        # This is crucial for users who might not have a profile yet.
        profile, created = UserProfile.objects.get_or_create(user=self.request.user)
        if created:
            print(f"Created UserProfile for {self.request.user.username}")
        return profile

    def perform_update(self, serializer):
        instance = serializer.save() # The serializer's update method handles file saving/clearing

        # Check if resume or job_description was part of the update data
        # If so, clear generated_mock_questions as they are now stale.
        request_data_keys = self.request.data.keys()
        # We also need to consider if a key was sent with a null value for clearing a file.
        # The serializer.validated_data will reflect the state after processing.
        # A more robust check is to see if these fields were in the initial request payload.

        # If 'resume' or 'job_description' was included in the request, even if set to null (for clearing)
        # then we should clear the questions.
        if 'resume' in request_data_keys or 'job_description' in request_data_keys:
            if instance.generated_mock_questions: # Only update if there's something to clear
                print(f"Clearing generated_mock_questions for user {instance.user.username} due to profile update.")
                instance.generated_mock_questions = None # Or [] depending on how you want to represent no questions
                instance.save(update_fields=['generated_mock_questions'])

    # Optional: Add specific PUT/PATCH handling if needed, but RetrieveUpdateAPIView handles it.
    # def put(self, request, *args, **kwargs):
    #     return self.update(request, *args, **kwargs)

    # def patch(self, request, *args, **kwargs):
    #     return self.partial_update(request, *args, **kwargs)

# --- End UserProfile View ---

# --- Mock Interview Question View ---

class GetMockInterviewQuestionsView(APIView):
    """
    API endpoint to generate mock interview questions based on the
    authenticated user's uploaded resume and job description.
    
    GET: Uses files from user's profile (existing functionality)
    POST: Accepts optional jd_url parameter to use URL instead of stored JD file
    
    Saves generated questions to the user's profile.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        """GET request - use existing files from profile"""
        return self._generate_questions_from_profile(request.user)

    def post(self, request, *args, **kwargs):
        """POST request - supports jd_url parameter"""
        user = request.user
        jd_url = request.data.get('jd_url', '').strip()
        
        print(f"[POST_REQUEST] User {user.id} requesting questions with jd_url: {jd_url}")
        
        if jd_url:
            return self._generate_questions_with_url(user, jd_url)
        else:
            # No URL provided, fall back to profile files
            return self._generate_questions_from_profile(user)

    def _generate_questions_from_profile(self, user):
        """Generate questions using files from user's profile"""
        try:
            profile = UserProfile.objects.get(user=user)
        except UserProfile.DoesNotExist:
            return Response({"error": "User profile not found. Please upload files first."}, status=status.HTTP_404_NOT_FOUND)

        if not profile.resume or not profile.job_description:
            return Response({"error": "Missing required file(s). Please upload both a resume and a job description."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            resume_text = extract_text_from_file(profile.resume)
            jd_text = extract_text_from_file(profile.job_description)
        except ValueError as e:
            print(f"Error extracting text for user {user.id}: {e}")
            error_message = str(e)
            if "not found at the specified URL" in error_message or "Could not retrieve file" in error_message:
                return Response({"error": f"Failed to process files: {error_message}. Please try re-uploading."}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"error": f"Error processing uploaded files: {e}. Please try uploading again or check file formats."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Unexpected error during text extraction for user {user.id}: {e}")
            traceback.print_exc()
            return Response({"error": "An unexpected error occurred while processing your files."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return self._generate_and_save_questions(user, resume_text, jd_text, save_to_profile=True)

    def _generate_questions_with_url(self, user, jd_url):
        """Generate questions using URL for JD and profile resume"""
        try:
            profile = UserProfile.objects.get(user=user)
        except UserProfile.DoesNotExist:
            return Response({"error": "User profile not found. Please upload a resume first."}, status=status.HTTP_404_NOT_FOUND)

        if not profile.resume:
            return Response({"error": "Missing resume. Please upload a resume to your profile first."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Extract resume text from profile
            resume_text = extract_text_from_file(profile.resume)
        except ValueError as e:
            print(f"Error extracting resume text for user {user.id}: {e}")
            return Response({"error": f"Error processing resume file: {e}. Please try re-uploading your resume."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Unexpected error during resume extraction for user {user.id}: {e}")
            traceback.print_exc()
            return Response({"error": "An unexpected error occurred while processing your resume."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            # Extract JD text from URL
            print(f"[URL_EXTRACTION] Extracting JD text from URL for user {user.id}: {jd_url}")
            jd_text = extract_text_from_url(jd_url)
        except ValueError as e:
            print(f"Error extracting text from URL for user {user.id}: {e}")
            return Response({"error": f"Error processing job posting URL: {e}"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Unexpected error during URL extraction for user {user.id}: {e}")
            traceback.print_exc()
            return Response({"error": "An unexpected error occurred while processing the job posting URL."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Don't save questions to profile when using URL (since JD is not from profile)
        return self._generate_and_save_questions(user, resume_text, jd_text, save_to_profile=False, jd_source_url=jd_url)

    def _generate_and_save_questions(self, user, resume_text, jd_text, save_to_profile=True, jd_source_url=None):
        """Generate questions, extract company name, and optionally save to profile"""
        if not resume_text or not jd_text:
            print(f"[VALIDATION_ERROR] For user {user.id}, could not extract text from one or both sources.")
            return Response({"error": "Could not extract text from one or both sources. Ensure they are valid and not empty."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Generate questions
            questions = generate_mock_questions(resume_text, jd_text)
            print(f"[DEBUG] Generated questions for user {user.id}: Type={type(questions)}, Count={len(questions) if isinstance(questions, list) else 'N/A'}")

            if not isinstance(questions, list):
                print(f"[ERROR_TYPE] For user {user.id}, generated questions are not a list as expected: Type={type(questions)}")

            # Extract company name from JD
            try:
                company_name = extract_company_name(jd_text, jd_source_url)
                print(f"[COMPANY_EXTRACTION] Extracted company name for user {user.id}: {company_name}")
            except Exception as e:
                print(f"[ERROR_COMPANY_EXTRACTION] Error extracting company name for user {user.id}: {e}")
                company_name = "Unknown Company"

            if save_to_profile:
                # Save questions to profile only when using profile files
                try:
                    profile = UserProfile.objects.get(user=user)
                    profile.generated_mock_questions = questions
                    profile.save(update_fields=['generated_mock_questions'])
                    print(f"[SAVE_SUCCESS] Questions saved to profile for user {user.id}")
                except Exception as save_exception:
                    print(f"[ERROR_DURING_SAVE] Exception saving questions for user {user.id}: {save_exception}")
                    traceback.print_exc()
                    # Continue even if save fails - return the questions anyway
            else:
                print(f"[NO_SAVE] Questions not saved to profile (URL-based generation) for user {user.id}")

            return Response({"questions": questions, "company_name": company_name})
            
        except RuntimeError as e:
            print(f"[ERROR_RUNTIME_GENERATION] RuntimeError generating questions for user {user.id}: {e}")
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            print(f"[ERROR_UNEXPECTED_GENERATION] Exception generating questions for user {user.id}: {e}")
            traceback.print_exc()
            return Response({"error": "Failed to generate questions due to an internal error."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --- End Mock Interview Question View ---

# --- Interview ViewSet ---
class InterviewViewSet(viewsets.ModelViewSet):
    queryset = Interview.objects.none() # Default queryset
    serializer_class = InterviewSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser) # For file uploads
    permission_classes = [permissions.IsAuthenticated, IsOwner] # IsOwner will check interview.user

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            return Interview.objects.filter(user=user).order_by('-created_at')
        return Interview.objects.none()

    def get_serializer_class(self):
        if self.action == 'create':
            return InterviewCreateSerializer
        return InterviewSerializer

    def perform_create(self, serializer):
        """
        Save the interview instance, handle multiple S3 answer audio uploads,
        and trigger transcription task.
        """
        user = self.request.user
        
        # Check if company name is provided and use it for interview naming
        company_name = self.request.data.get('company_name', '').strip()
        if company_name and company_name != "Unknown Company":
            # Use just the company name (date is already captured in created_at field)
            interview_name = company_name
            serializer.validated_data['name'] = interview_name
            print(f"[INTERVIEW_NAMING] Using company-based name for user {user.id}: {interview_name}")
        else:
            # Fallback to timestamp-based naming if no company name
            print(f"[INTERVIEW_NAMING] Using fallback naming for user {user.id} (company_name: {company_name})")
        
        instance = serializer.save(user=user)
        
        # Handle multiple answer audio files
        s3_keys_for_model = []
        index = 0
        while True:
            field_name = f'answer_audio_{index}'
            if field_name not in self.request.FILES:
                break
            
            audio_file = self.request.FILES[field_name]
            file_content_bytes = audio_file.read()
            content_type = audio_file.content_type
            
            task_logger.info(f"Processing uploaded file: {audio_file.name}, Content-Type: {content_type}, Size: {len(file_content_bytes)}")

            # Determine file extension based on content type
            file_extension = 'webm' # Default
            if content_type: # Ensure content_type is not None
                if 'wav' in content_type.lower() or 'pcm' in content_type.lower():
                    file_extension = 'wav'
            
            # Construct S3 key using user_id, instance.id, and determined extension
            s3_key = f"{settings.AWS_LOCATION}/interviews/{user.id}/{instance.id}/answers/answer_{index}.{file_extension}"
            task_logger.info(f"Attempting to save to S3 key: {s3_key} with determined content type for S3: {content_type or 'application/octet-stream'}")

            try:
                s3_client = boto3.client(
                    's3',
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_S3_REGION_NAME
                )
                
                s3_client.put_object(
                    Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                    Key=s3_key,
                    Body=file_content_bytes,
                    ContentType=content_type or 'application/octet-stream' # Use actual content type or a default
                )
                # Verify object existence (optional, but good for debugging)
                s3_client.head_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=s3_key)
                task_logger.info(f"Successfully saved and verified {s3_key} in S3 bucket {settings.AWS_STORAGE_BUCKET_NAME}")
                s3_keys_for_model.append(s3_key)
            except Exception as e:
                task_logger.error(f"Error saving {s3_key} to S3: {e}", exc_info=True)
                # Decide if one failure should prevent interview creation or just skip this file
                # For now, let's be strict: if an audio file fails to save, don't save the interview record
                raise serializers.ValidationError({"audio_upload_error": f"Failed to save answer {index} to S3: {str(e)}"})

            index += 1
        
        if not s3_keys_for_model and index > 0: # Files were expected but none saved
            task_logger.error(f"Interview {instance.id} for user {user.id}: Files were present in request but failed to save to S3.")
            raise serializers.ValidationError({"audio_upload_error": "Audio files were provided but could not be saved."})
        elif not s3_keys_for_model and index == 0: # No files were provided at all (e.g. answer_audio_0 not found)
            task_logger.warning(f"Interview {instance.id} for user {user.id}: No answer audio files found in the request.")
            # Allow creation if no audio files are sent, but s3_keys_for_model will be empty.
            # This behavior might need adjustment based on product requirements (e.g., require at least one answer).

        instance.answer_audio_s3_keys = s3_keys_for_model
        instance.save()
        
        # Trigger background task for transcription
        if instance.answer_audio_s3_keys: # Only trigger if there are keys to process
            task_logger.info(f"Scheduling interview transcription task for Interview ID: {instance.id} with {len(instance.answer_audio_s3_keys)} audio files.")
            process_interview_transcription_task(instance.id)
        else:
            task_logger.info(f"No audio files processed for Interview ID: {instance.id}. Transcription task not scheduled.")

    def perform_destroy(self, instance):
        # Delete associated S3 files for answer audios
        if instance.answer_audio_s3_keys:
            try:
                s3_client = boto3.client(
                    's3',
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_S3_REGION_NAME
                )
                for s3_key in instance.answer_audio_s3_keys: # These keys already include AWS_LOCATION if saved that way
                    try:
                        # Check if object exists using head_object
                        s3_client.head_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=s3_key)
                        # If head_object does not raise an error, the object exists, so delete it
                        s3_client.delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=s3_key)
                        task_logger.info(f"Successfully deleted S3 object: {s3_key}") # Use task_logger
                    except ClientError as e:
                        if e.response['Error']['Code'] == '404':
                            task_logger.warning(f"S3 object not found for deletion (boto3 head_object check): {s3_key}")
                        else:
                            task_logger.error(f"ClientError during S3 object deletion ({s3_key}): {e}")
                    except Exception as e: # Catch other potential errors during S3 operations
                        task_logger.error(f"Unexpected error deleting S3 object {s3_key}: {e}")
            except Exception as e:
                task_logger.error(f"Failed to initialize S3 client for deletion: {e}")
        
        # Delete the interview instance itself
        instance.delete()

# --- End Interview ViewSet ---

# --- Deepgram TTS View ---
class GenerateTTSAudioView(APIView):
    permission_classes = [IsAuthenticated] # Protect this endpoint

    def post(self, request, *args, **kwargs):
        text_to_speak = request.data.get('text')
        if not text_to_speak:
            return Response({"error": "No text provided for TTS."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Initialize Deepgram client
            # Assumes DEEPGRAM_API_KEY is in your environment variables (e.g., .env file)
            # and loaded by Django (e.g. python-dotenv in manage.py or settings.py)
            api_key = os.environ.get('DEEPGRAM_API_KEY')
            if not api_key:
                print("ERROR: DEEPGRAM_API_KEY not found in environment for TTS view.")
                return Response({"error": "TTS service not configured."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            deepgram = DeepgramClient(api_key)

            # Configure speak options
            # Refer to Deepgram SpeakOptions documentation for available models and options
            # https://developers.deepgram.com/docs/speak-options
            options = SpeakOptions(
                model="aura-asteria-en", # Example model, choose based on your needs
                encoding="linear16",      # Audio encoding for WAV
                container="wav", # Expected container
                sample_rate=24000     # Aura models often default to 24kHz
            )
            
            print(f"Requesting TTS from Deepgram for text: '{text_to_speak[:50]}...' with options: model={options.model}, encoding={options.encoding}, container={options.container}, sample_rate={options.sample_rate}")
            # Use the stream method for TTS
            response_stream = deepgram.speak.v("1").stream({'text': text_to_speak}, options)
            
            # The response_stream object from Deepgram SDK (v3+) has a 'stream' attribute
            # which is an HTTPX ReadStream. We need to iterate over this stream.
            # StreamingHttpResponse expects an iterator that yields byte strings.

            if hasattr(response_stream, 'stream') and response_stream.stream:
                # Define a generator function to iterate over the stream chunks
                def audio_chunk_generator():
                    for chunk in response_stream.stream:
                        yield chunk
                
                # For debugging, you can check the headers from response_stream.headers
                # print(f"Deepgram TTS Response Headers: {response_stream.headers}")
                # content_type = response_stream.headers.get('Content-Type', 'audio/mpeg') # Get actual content type

                return StreamingHttpResponse(
                    audio_chunk_generator(), 
                    content_type='audio/wav' # Ensure this matches your SpeakOptions container
                )
            else:
                print("ERROR: Deepgram TTS stream was not available in the response.")
                return Response({"error": "Failed to get audio stream from TTS provider."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except Exception as e:
            print(f"ERROR during Deepgram TTS request: {e}")
            traceback.print_exc()
            return Response({"error": "An error occurred while generating speech."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --- End Deepgram TTS View ---