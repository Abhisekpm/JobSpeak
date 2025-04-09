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
    Background task to generate detailed, balanced, and short summaries in a chain.
    Detailed uses recap text, Balanced uses Detailed, Short uses Balanced.
    """
    task_logger.info(f"[Summary Task] Starting process for Conversation ID: {conversation_id}")
    try:
        conversation = Conversation.objects.get(id=conversation_id)
    except Conversation.DoesNotExist:
        task_logger.error(f"[Summary Task] Conversation ID {conversation_id} not found. Aborting.")
        return

    # Prerequisite: Recap must be completed and have text
    if conversation.status_recap != Conversation.STATUS_COMPLETED or not conversation.recap_text:
        task_logger.warning(f"[Summary Task] Recap not completed or text missing for {conversation_id}. Aborting summary.")
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

        summary_results = {
            "detailed": None,
            "balanced": None,
            "short": None
        }
        current_input_text = conversation.recap_text
        error_occurred = False

        # 1. Generate Detailed Summary (from Recap Text)
        task_logger.info(f"[Summary Task] Generating detailed summary (focus 10) from recap...")
        detailed_summary = summarize_transcript(current_input_text, focus=10)
        if detailed_summary:
            summary_results["detailed"] = detailed_summary
            current_input_text = detailed_summary # Input for next step
            task_logger.info(f"[Summary Task] Generated detailed summary.")
        else:
            task_logger.error(f"[Summary Task] Failed to generate detailed summary for {conversation.id}. Aborting chain.")
            error_occurred = True

        # 2. Generate Balanced Summary (from Detailed Summary)
        if not error_occurred:
            task_logger.info(f"[Summary Task] Generating balanced summary (focus 5) from detailed summary...")
            balanced_summary = summarize_transcript(current_input_text, focus=5)
            if balanced_summary:
                summary_results["balanced"] = balanced_summary
                current_input_text = balanced_summary # Input for next step
                task_logger.info(f"[Summary Task] Generated balanced summary.")
            else:
                task_logger.error(f"[Summary Task] Failed to generate balanced summary for {conversation.id}. Aborting chain.")
                error_occurred = True

        # 3. Generate Short Summary (from Balanced Summary)
        if not error_occurred:
            task_logger.info(f"[Summary Task] Generating short summary (focus 1) from balanced summary...")
            short_summary = summarize_transcript(current_input_text, focus=1)
            if short_summary:
                summary_results["short"] = short_summary
                task_logger.info(f"[Summary Task] Generated short summary.")
            else:
                # Don't mark as error, maybe short summary just failed?
                task_logger.warning(f"[Summary Task] Failed to generate short summary for {conversation.id}. Proceeding with other results.")
                # error_occurred = True # Decide if this should halt completion

        # --- Update Model --- 
        conversation.summary_data = summary_results
        # Mark completed only if the crucial detailed/balanced summaries were generated
        if summary_results["detailed"] and summary_results["balanced"]:
             conversation.status_summary = Conversation.STATUS_COMPLETED
             task_logger.info(f"[Summary Task] Status set to COMPLETED for Conversation ID: {conversation.id}")
        else:
             # If the chain broke early, mark as failed
             conversation.status_summary = Conversation.STATUS_FAILED
             task_logger.error(f"[Summary Task] Summary chain failed (detailed or balanced summary missing). Status set to FAILED for Conversation ID: {conversation.id}")
        
        conversation.save(update_fields=['summary_data', 'status_summary', 'updated_at'])

    except Exception as e:
        task_logger.error(f"[Summary Task] Unexpected error during processing for Conversation ID {conversation.id}: {e}", exc_info=True)
        try:
            # Ensure status is FAILED on any unexpected exception
            conversation.status_summary = Conversation.STATUS_FAILED
            # Optionally clear summary_data if it's partially filled and inconsistent
            conversation.summary_data = summary_results if 'summary_results' in locals() else {} 
            conversation.save(update_fields=['summary_data', 'status_summary', 'updated_at'])
            task_logger.info(f"[Summary Task] Status set to FAILED due to unexpected error for Conversation ID: {conversation.id}")
        except Exception as save_exc:
            task_logger.error(f"[Summary Task] Could not mark as failed after unexpected error for Conversation ID {conversation.id}: {save_exc}") 