import time
from .models import Conversation
from background_task import background # Import the background decorator
# Import the service
from .services.transcription import DeepgramTranscriptionService

# Use the @background decorator
@background(schedule=1) # Schedule to run 1 second after being called
def process_transcription_task(conversation_id):
    """
    Background task to process transcription using Deepgram service.
    """
    print(f"[Background Task] Starting transcription process for Conversation ID: {conversation_id}")
    try:
        conversation = Conversation.objects.get(id=conversation_id)
    except Conversation.DoesNotExist:
        print(f"[Background Task] Conversation ID {conversation_id} not found. Aborting.")
        return

    if not conversation.audio_file:
        print(f"[Background Task] No audio file for Conversation ID: {conversation_id}. Marking failed.")
        conversation.status_transcription = Conversation.STATUS_FAILED
        conversation.save(update_fields=['status_transcription', 'updated_at'])
        return

    try:
        # Mark as processing
        conversation.status_transcription = Conversation.STATUS_PROCESSING
        conversation.save(update_fields=['status_transcription', 'updated_at'])
        print(f"[Background Task] Status set to PROCESSING for Conversation ID: {conversation.id}")

        # --- Call the Deepgram Service --- 
        # Get the file path (ensure worker has access to MEDIA_ROOT)
        audio_path = conversation.audio_file.path
        print(f"[Background Task] Audio file path: {audio_path}")

        # Define Deepgram options (**kwargs)
        deepgram_options = {
            'model': 'nova-2',        # Example model
            'language': 'en-US',     # Example language
            'punctuate': True,
            'diarize': False,        # Example feature
            # Add other relevant Deepgram parameters here
        }

        # Instantiate and call the service
        service = DeepgramTranscriptionService()
        print(f"[Background Task] Calling Deepgram service with options: {deepgram_options}")
        # Call the correct method that returns the transcript string
        transcription_result = service.get_full_transcript(audio_path, **deepgram_options)
        # ----------------------------------

        # Update model with results
        conversation.transcription_text = transcription_result # This should now be the text string
        conversation.status_transcription = Conversation.STATUS_COMPLETED
        conversation.save(update_fields=['transcription_text', 'status_transcription', 'updated_at'])
        print(f"[Background Task] Status set to COMPLETED for Conversation ID: {conversation.id}")

    except Exception as e:
        print(f"[Background Task] Error during transcription processing for Conversation ID {conversation.id}: {e}")
        try:
            conversation.status_transcription = Conversation.STATUS_FAILED
            conversation.save(update_fields=['status_transcription', 'updated_at'])
        except Exception as save_exc:
            print(f"[Background Task] Could not mark as failed for Conversation ID {conversation.id}: {save_exc}")
        # Consider logging the exception details more thoroughly here 