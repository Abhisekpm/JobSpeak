from rest_framework import viewsets, status, permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Conversation
from .serializers import ConversationSerializer, UserSerializer, ConversationCreateSerializer
from .permissions import IsOwner
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from .tasks import process_transcription_task
from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from rest_framework_simplejwt.tokens import RefreshToken

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