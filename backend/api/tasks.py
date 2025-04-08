import time
import json # Import the json library
import logging # Import logging

from .models import Conversation
from background_task import background # Import the background decorator
# Import the services
from .services.transcription import DeepgramTranscriptionService
from .services.recap import recap_interview # Corrected import name
from .services.summary import summarize_transcript # Import the summary service

# Configure logging for tasks
task_logger = logging.getLogger('background_tasks')
task_logger.setLevel(logging.INFO)

# Use the @background decorator
@background(schedule=1) # Schedule to run 1 second after being called
def process_transcription_task(conversation_id):
    """
    Background task to process transcription using Deepgram service.
    """
    task_logger.info(f"[Transcription Task] Starting process for Conversation ID: {conversation_id}")
    try:
        conversation = Conversation.objects.get(id=conversation_id)
    except Conversation.DoesNotExist:
        task_logger.error(f"[Transcription Task] Conversation ID {conversation_id} not found. Aborting.")
        return

    if not conversation.audio_file:
        task_logger.warning(f"[Transcription Task] No audio file for Conversation ID: {conversation_id}. Marking failed.")
        conversation.status_transcription = Conversation.STATUS_FAILED
        conversation.save(update_fields=['status_transcription', 'updated_at'])
        return

    # Ensure recap status is pending if we start transcription
    if conversation.status_recap != Conversation.STATUS_PENDING:
        conversation.status_recap = Conversation.STATUS_PENDING
        conversation.recap_text = None # Clear any old recap
        conversation.save(update_fields=['status_recap', 'recap_text', 'updated_at'])

    try:
        # Mark as processing
        conversation.status_transcription = Conversation.STATUS_PROCESSING
        conversation.save(update_fields=['status_transcription', 'updated_at'])
        task_logger.info(f"[Transcription Task] Status set to PROCESSING for Conversation ID: {conversation.id}")

        # --- Call the Deepgram Service --- 
        audio_path = conversation.audio_file.path
        task_logger.info(f"[Transcription Task] Audio file path: {audio_path}")

        deepgram_options = {
            'model': 'nova-2',        # Example model
            'language': 'en-US',     # Example language
            'punctuate': True,
            'diarize': True,        # Enable diarization to get speaker labels
            'utterances': True,     # Keep utterances enabled, might be useful
            'smart_format': True,   # Keep smart format enabled
        }

        service = DeepgramTranscriptionService()
        task_logger.info(f"[Transcription Task] Calling Deepgram service with options: {deepgram_options}")
        structured_transcription_result = service.get_full_transcript(audio_path, **deepgram_options)
        # ----------------------------------

        if not structured_transcription_result:
             task_logger.warning(f"[Transcription Task] Deepgram returned no result for {conversation.id}. Marking failed.")
             raise ValueError("Transcription result was empty")

        # Serialize the structured result to a JSON string before saving
        conversation.transcription_text = json.dumps(structured_transcription_result)
        conversation.status_transcription = Conversation.STATUS_COMPLETED
        conversation.save(update_fields=['transcription_text', 'status_transcription', 'updated_at'])
        task_logger.info(f"[Transcription Task] Status set to COMPLETED for Conversation ID: {conversation.id}")

        # --- Trigger Recap Task --- 
        task_logger.info(f"[Transcription Task] Scheduling recap task for Conversation ID: {conversation.id}")
        process_recap_task(conversation.id, schedule=5) # Schedule recap 5 seconds later
        # --------------------------

    except Exception as e:
        task_logger.error(f"[Transcription Task] Error during processing for Conversation ID {conversation.id}: {e}", exc_info=True)
        try:
            conversation.status_transcription = Conversation.STATUS_FAILED
            # Also mark recap as failed if transcription failed
            conversation.status_recap = Conversation.STATUS_FAILED
            conversation.save(update_fields=['status_transcription', 'status_recap', 'updated_at'])
            task_logger.info(f"[Transcription Task] Status set to FAILED for Conversation ID: {conversation.id}")
        except Exception as save_exc:
            task_logger.error(f"[Transcription Task] Could not mark as failed for Conversation ID {conversation.id}: {save_exc}")

# --- New Recap Task --- 
@background(schedule=1)
def process_recap_task(conversation_id):
    """
    Background task to generate a recap for a completed transcription.
    """
    task_logger.info(f"[Recap Task] Starting process for Conversation ID: {conversation_id}")
    try:
        conversation = Conversation.objects.get(id=conversation_id)
    except Conversation.DoesNotExist:
        task_logger.error(f"[Recap Task] Conversation ID {conversation_id} not found. Aborting.")
        return

    # Check if transcription was successful and text exists
    if conversation.status_transcription != Conversation.STATUS_COMPLETED or not conversation.transcription_text:
        task_logger.warning(f"[Recap Task] Transcription not completed or text missing for {conversation_id}. Aborting recap.")
        # Optionally mark recap as failed or leave as pending?
        if conversation.status_recap == Conversation.STATUS_PENDING:
             conversation.status_recap = Conversation.STATUS_FAILED # Mark failed if it depended on transcription
             conversation.save(update_fields=['status_recap', 'updated_at'])
        return

    try:
        # Mark recap as processing
        conversation.status_recap = Conversation.STATUS_PROCESSING
        conversation.save(update_fields=['status_recap', 'updated_at'])
        task_logger.info(f"[Recap Task] Status set to PROCESSING for Conversation ID: {conversation.id}")

        # Parse the stored JSON transcription
        try:
            parsed_segments = json.loads(conversation.transcription_text)
            if not isinstance(parsed_segments, list):
                raise ValueError("Parsed transcription is not a list")
            # Format into a single string for the summarizer
            formatted_transcript = "\n".join([f"Speaker {seg.get('speaker', '?')}: {seg.get('transcript', '')}" for seg in parsed_segments])
        except (json.JSONDecodeError, ValueError, TypeError) as e:
            task_logger.error(f"[Recap Task] Failed to parse or format transcription JSON for {conversation.id}: {e}")
            raise ValueError(f"Invalid transcription format: {e}") # Propagate error

        if not formatted_transcript.strip():
             task_logger.warning(f"[Recap Task] Formatted transcript is empty for {conversation.id}. Skipping recap.")
             raise ValueError("Formatted transcript is empty")

        # --- Call the Recap Service --- 
        task_logger.info(f"[Recap Task] Calling recap_interview service for Conversation ID: {conversation.id}")
        recap_result = recap_interview(formatted_transcript)
        # ------------------------------

        if recap_result is None:
            task_logger.error(f"[Recap Task] Recap service failed or returned None for {conversation.id}")
            raise ValueError("Recap service failed")

        # Update model with results
        conversation.recap_text = recap_result
        conversation.status_recap = Conversation.STATUS_COMPLETED
        conversation.save(update_fields=['recap_text', 'status_recap', 'updated_at'])
        task_logger.info(f"[Recap Task] Status set to COMPLETED for Conversation ID: {conversation.id}")

        # --- Trigger Summary Task --- 
        # Ensure summary status is pending before triggering
        if conversation.status_summary == Conversation.STATUS_PENDING:
            task_logger.info(f"[Recap Task] Scheduling summary task for Conversation ID: {conversation.id}")
            process_summary_task(conversation.id, schedule=5) # Schedule summary 5 seconds later
        else:
            task_logger.info(f"[Recap Task] Summary task not triggered for {conversation.id} as status is not PENDING ({conversation.status_summary})")
        # --------------------------

    except Exception as e:
        task_logger.error(f"[Recap Task] Error during processing for Conversation ID {conversation.id}: {e}", exc_info=True)
        try:
            conversation.status_recap = Conversation.STATUS_FAILED
            # Also mark summary as failed if recap failed
            conversation.status_summary = Conversation.STATUS_FAILED 
            conversation.save(update_fields=['status_recap', 'status_summary', 'updated_at'])
            task_logger.info(f"[Recap Task] Status set to FAILED for Conversation ID: {conversation.id}")
        except Exception as save_exc:
            task_logger.error(f"[Recap Task] Could not mark as failed for Conversation ID {conversation.id}: {save_exc}")

# --- New Summary Task --- 
@background(schedule=1)
def process_summary_task(conversation_id):
    """
    Background task to generate short, balanced, and detailed summaries.
    """
    task_logger.info(f"[Summary Task] Starting process for Conversation ID: {conversation_id}")
    try:
        conversation = Conversation.objects.get(id=conversation_id)
    except Conversation.DoesNotExist:
        task_logger.error(f"[Summary Task] Conversation ID {conversation_id} not found. Aborting.")
        return

    # Check if transcription was successful and text exists
    if conversation.status_transcription != Conversation.STATUS_COMPLETED or not conversation.transcription_text:
        task_logger.warning(f"[Summary Task] Transcription not completed or text missing for {conversation_id}. Aborting summary.")
        if conversation.status_summary == Conversation.STATUS_PENDING:
             conversation.status_summary = Conversation.STATUS_FAILED
             conversation.save(update_fields=['status_summary', 'updated_at'])
        return

    try:
        # Mark summary as processing
        conversation.status_summary = Conversation.STATUS_PROCESSING
        conversation.summary_data = {} # Clear old data
        conversation.save(update_fields=['status_summary', 'summary_data', 'updated_at'])
        task_logger.info(f"[Summary Task] Status set to PROCESSING for Conversation ID: {conversation.id}")

        # Parse the stored JSON transcription (similar to recap task)
        try:
            parsed_segments = json.loads(conversation.transcription_text)
            if not isinstance(parsed_segments, list):
                raise ValueError("Parsed transcription is not a list")
            # Format into a single string for the summarizer
            formatted_transcript = "\n".join([f"Speaker {seg.get('speaker', '?')}: {seg.get('transcript', '')}" for seg in parsed_segments])
        except (json.JSONDecodeError, ValueError, TypeError) as e:
            task_logger.error(f"[Summary Task] Failed to parse or format transcription JSON for {conversation.id}: {e}")
            raise ValueError(f"Invalid transcription format: {e}") # Propagate error

        if not formatted_transcript.strip():
             task_logger.warning(f"[Summary Task] Formatted transcript is empty for {conversation.id}. Skipping summary.")
             raise ValueError("Formatted transcript is empty")

        # --- Call the Summary Service for each focus level --- 
        summary_results = {}
        focus_levels = {"short": 1, "balanced": 5, "detailed": 10}
        
        task_logger.info(f"[Summary Task] Calling summarize_transcript service for Conversation ID: {conversation.id}")
        for key, focus in focus_levels.items():
            task_logger.info(f"[Summary Task] Generating summary with focus {focus} ({key})...")
            summary = summarize_transcript(formatted_transcript, focus=focus)
            if summary is None:
                task_logger.warning(f"[Summary Task] Summary service returned None for focus {focus} ({key}) for {conversation.id}")
                # Store None or an empty string? Decide based on requirements.
                summary_results[key] = None 
            else:
                summary_results[key] = summary
                task_logger.info(f"[Summary Task] Generated summary for focus {focus} ({key}).")
        # ------------------------------------------------------

        # Check if at least one summary was generated
        if not any(summary_results.values()):
            task_logger.error(f"[Summary Task] All summary generations failed or returned None for {conversation.id}")
            raise ValueError("Summary service failed for all focus levels")

        # Update model with results
        conversation.summary_data = summary_results
        conversation.status_summary = Conversation.STATUS_COMPLETED
        conversation.save(update_fields=['summary_data', 'status_summary', 'updated_at'])
        task_logger.info(f"[Summary Task] Status set to COMPLETED for Conversation ID: {conversation.id}")

    except Exception as e:
        task_logger.error(f"[Summary Task] Error during processing for Conversation ID {conversation.id}: {e}", exc_info=True)
        try:
            conversation.status_summary = Conversation.STATUS_FAILED
            conversation.save(update_fields=['status_summary', 'updated_at'])
            task_logger.info(f"[Summary Task] Status set to FAILED for Conversation ID: {conversation.id}")
        except Exception as save_exc:
            task_logger.error(f"[Summary Task] Could not mark as failed for Conversation ID {conversation.id}: {save_exc}") 