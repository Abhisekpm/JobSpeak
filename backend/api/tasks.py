import time
from .models import Conversation
from background_task import background # Import the background decorator

# Use the @background decorator
@background(schedule=1) # Schedule to run 1 second after being called
def process_transcription_task(conversation_id):
    """
    Background task (using django-background-tasks) to simulate processing transcription.
    """
    print(f"[Background Task] Starting transcription process for Conversation ID: {conversation_id}")
    try:
        conversation = Conversation.objects.get(id=conversation_id)
    except Conversation.DoesNotExist:
        print(f"[Background Task] Conversation ID {conversation_id} not found. Aborting task.")
        return # Task finishes if conversation not found

    if not conversation.audio_file:
        print(f"[Background Task] No audio file found for Conversation ID: {conversation_id}. Marking as failed.")
        conversation.status_transcription = Conversation.STATUS_FAILED
        conversation.save(update_fields=['status_transcription', 'updated_at'])
        return

    try:
        conversation.status_transcription = Conversation.STATUS_PROCESSING
        conversation.save(update_fields=['status_transcription', 'updated_at'])
        print(f"[Background Task] Status set to PROCESSING for Conversation ID: {conversation.id}")

        print(f"[Background Task] Simulating transcription work for Conversation ID: {conversation.id}...")
        time.sleep(10) # Simulate work

        dummy_text = f"[Async Result via DB Task] This is the simulated transcription for conversation {conversation.id}. The audio file processed was {conversation.audio_file.name}. It contained important details discussed on {conversation.created_at.strftime('%Y-%m-%d')}."
        conversation.transcription_text = dummy_text
        conversation.status_transcription = Conversation.STATUS_COMPLETED
        conversation.save(update_fields=['transcription_text', 'status_transcription', 'updated_at'])
        print(f"[Background Task] Status set to COMPLETED for Conversation ID: {conversation.id}")

    except Exception as e:
        print(f"[Background Task] Error processing Conversation ID {conversation.id}: {e}")
        try:
            conversation.status_transcription = Conversation.STATUS_FAILED
            conversation.save(update_fields=['status_transcription', 'updated_at'])
        except Exception as save_exc:
            print(f"[Background Task] Could not mark as failed for Conversation ID {conversation.id}: {save_exc}")
        # Don't re-raise, just let the task finish after logging the error 