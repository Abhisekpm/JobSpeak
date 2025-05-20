import time
import json # Import the json library
import logging # Import logging

from .models import Conversation, Interview
from background_task import background # Import the background decorator
# Import the services
from .services.transcription import DeepgramTranscriptionService
from .services.recap import recap_interview # Corrected import name
from .services.summary import summarize_transcript # Import the summary service
from .services.analysis import analyze_conversation # Import the analysis service
from .services.coaching import generate_coaching_feedback # Import the coaching service

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

    if not conversation.audio_file or not conversation.audio_file.name:
        task_logger.warning(f"[Transcription Task] No audio file or file name for Conversation ID: {conversation.id}. Marking failed.")
        conversation.status_transcription = Conversation.STATUS_FAILED
        # Mark downstream tasks as failed too
        conversation.status_recap = Conversation.STATUS_FAILED
        conversation.status_summary = Conversation.STATUS_FAILED
        conversation.status_analysis = Conversation.STATUS_FAILED
        conversation.status_coaching = Conversation.STATUS_FAILED
        conversation.save(update_fields=['status_transcription', 'status_recap', 'status_summary', 'status_analysis', 'status_coaching', 'updated_at'])
        return

    # Reset downstream statuses to PENDING when starting transcription
    fields_to_update = ['status_transcription']
    if conversation.status_recap != Conversation.STATUS_PENDING:
        conversation.status_recap = Conversation.STATUS_PENDING
        conversation.recap_text = None
        fields_to_update.extend(['status_recap', 'recap_text'])
    if conversation.status_summary != Conversation.STATUS_PENDING:
        conversation.status_summary = Conversation.STATUS_PENDING
        conversation.summary_data = {}
        fields_to_update.extend(['status_summary', 'summary_data'])
    if conversation.status_analysis != Conversation.STATUS_PENDING:
        conversation.status_analysis = Conversation.STATUS_PENDING
        conversation.analysis_results = None
        fields_to_update.extend(['status_analysis', 'analysis_results'])
    if conversation.status_coaching != Conversation.STATUS_PENDING:
        conversation.status_coaching = Conversation.STATUS_PENDING
        conversation.coaching_feedback = None
        fields_to_update.extend(['status_coaching', 'coaching_feedback'])

    try:
        # Mark transcription as processing
        conversation.status_transcription = Conversation.STATUS_PROCESSING
        fields_to_update.append('updated_at')
        conversation.save(update_fields=fields_to_update)
        task_logger.info(f"[Transcription Task] Status set to PROCESSING for Conversation ID: {conversation.id}")

        # --- Get the S3 URL for the audio file --- 
        try:
            audio_url = conversation.audio_file.url # This should now be the public S3 URL
            task_logger.info(f"[Transcription Task] Audio file URL: {audio_url}")
        except Exception as url_err:
            task_logger.error(f"[Transcription Task] Could not get audio file URL for {conversation.id}: {url_err}")
            raise # Re-raise to mark transcription as failed
        # -------------------------------------------

        deepgram_options = {
            'model': 'nova-2',
            'language': 'en-US',
            'punctuate': True,
            'diarize': True,
            'utterances': True,
            'smart_format': True,
        }

        service = DeepgramTranscriptionService()
        task_logger.info(f"[Transcription Task] Calling Deepgram service with URL and options: {deepgram_options}")
        # Pass the URL to the service method
        structured_transcription_result = service.get_full_transcript(audio_url=audio_url, **deepgram_options)
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
            # Also mark downstream as failed if transcription failed
            conversation.status_recap = Conversation.STATUS_FAILED
            conversation.status_summary = Conversation.STATUS_FAILED
            conversation.status_analysis = Conversation.STATUS_FAILED
            conversation.status_coaching = Conversation.STATUS_FAILED
            conversation.save(update_fields=['status_transcription', 'status_recap', 'status_summary', 'status_analysis', 'status_coaching', 'updated_at'])
            task_logger.info(f"[Transcription Task] Status set to FAILED for Conversation ID: {conversation.id}")
        except Exception as save_exc:
            task_logger.error(f"[Transcription Task] Could not mark as failed for Conversation ID {conversation.id}: {save_exc}")

# --- Recap Task ---
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
        if conversation.status_recap == Conversation.STATUS_PENDING:
             conversation.status_recap = Conversation.STATUS_FAILED
             # Mark downstream tasks as failed
             conversation.status_summary = Conversation.STATUS_FAILED
             conversation.status_analysis = Conversation.STATUS_FAILED
             conversation.status_coaching = Conversation.STATUS_FAILED
             conversation.save(update_fields=['status_recap', 'status_summary', 'status_analysis', 'status_coaching', 'updated_at'])
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
            # Format into a single string for the summarizer/recap
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

        # --- Trigger Downstream Tasks (Summary, Analysis, Coaching) ---
        schedule_delay = 5 # seconds
        if conversation.status_summary == Conversation.STATUS_PENDING:
            task_logger.info(f"[Recap Task] Scheduling summary task for Conversation ID: {conversation.id}")
            process_summary_task(conversation.id, schedule=schedule_delay)
        if conversation.status_analysis == Conversation.STATUS_PENDING:
            task_logger.info(f"[Recap Task] Scheduling analysis task for Conversation ID: {conversation.id}")
            process_analysis_task(conversation.id, schedule=schedule_delay)
        if conversation.status_coaching == Conversation.STATUS_PENDING:
            task_logger.info(f"[Recap Task] Scheduling coaching task for Conversation ID: {conversation.id}")
            process_coaching_task(conversation.id, schedule=schedule_delay)
        # ---------------------------------------------------------------

    except Exception as e:
        task_logger.error(f"[Recap Task] Error during processing for Conversation ID {conversation.id}: {e}", exc_info=True)
        try:
            conversation.status_recap = Conversation.STATUS_FAILED
            # Also mark downstream as failed if recap failed
            conversation.status_summary = Conversation.STATUS_FAILED
            conversation.status_analysis = Conversation.STATUS_FAILED
            conversation.status_coaching = Conversation.STATUS_FAILED
            conversation.save(update_fields=['status_recap', 'status_summary', 'status_analysis', 'status_coaching', 'updated_at'])
            task_logger.info(f"[Recap Task] Status set to FAILED for Conversation ID: {conversation.id}")
        except Exception as save_exc:
            task_logger.error(f"[Recap Task] Could not mark as failed for Conversation ID {conversation.id}: {save_exc}")


# --- Summary Task ---
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


# --- NEW Analysis Task ---
@background(schedule=1)
def process_analysis_task(conversation_id):
    """
    Background task to generate conversation analysis (talk time, sentiment, topics).
    Uses recap text as input.
    """
    task_logger.info(f"[Analysis Task] Starting process for Conversation ID: {conversation_id}")
    try:
        conversation = Conversation.objects.get(id=conversation_id)
    except Conversation.DoesNotExist:
        task_logger.error(f"[Analysis Task] Conversation ID {conversation_id} not found. Aborting.")
        return

    # Prerequisite: Recap must be completed and have text
    if conversation.status_recap != Conversation.STATUS_COMPLETED or not conversation.recap_text:
        task_logger.warning(f"[Analysis Task] Recap not completed or text missing for {conversation_id}. Aborting analysis.")
        if conversation.status_analysis == Conversation.STATUS_PENDING:
             conversation.status_analysis = Conversation.STATUS_FAILED
             conversation.save(update_fields=['status_analysis', 'updated_at'])
        return

    try:
        # Mark analysis as processing
        conversation.status_analysis = Conversation.STATUS_PROCESSING
        conversation.analysis_results = None # Clear old data
        conversation.save(update_fields=['status_analysis', 'analysis_results', 'updated_at'])
        task_logger.info(f"[Analysis Task] Status set to PROCESSING for Conversation ID: {conversation.id}")

        # --- Call the Analysis Service ---
        task_logger.info(f"[Analysis Task] Calling analyze_conversation service for Conversation ID: {conversation.id}")
        analysis_result = analyze_conversation(conversation.recap_text)
        # -------------------------------

        if analysis_result is None:
            task_logger.error(f"[Analysis Task] Analysis service failed or returned None for {conversation.id}")
            raise ValueError("Analysis service failed")

        # Update model with results (analysis_result should be a dict/JSON compatible)
        conversation.analysis_results = analysis_result
        conversation.status_analysis = Conversation.STATUS_COMPLETED
        conversation.save(update_fields=['analysis_results', 'status_analysis', 'updated_at'])
        task_logger.info(f"[Analysis Task] Status set to COMPLETED for Conversation ID: {conversation.id}")

    except Exception as e:
        task_logger.error(f"[Analysis Task] Error during processing for Conversation ID {conversation.id}: {e}", exc_info=True)
        try:
            conversation.status_analysis = Conversation.STATUS_FAILED
            conversation.save(update_fields=['status_analysis', 'updated_at'])
            task_logger.info(f"[Analysis Task] Status set to FAILED for Conversation ID: {conversation.id}")
        except Exception as save_exc:
            task_logger.error(f"[Analysis Task] Could not mark as failed for Conversation ID {conversation.id}: {save_exc}")


# --- NEW Coaching Task ---
@background(schedule=1)
def process_coaching_task(conversation_id):
    """
    Background task to generate coaching feedback.
    Uses the formatted original transcript text as input.
    """
    task_logger.info(f"[Coaching Task] Starting process for Conversation ID: {conversation_id}")
    try:
        conversation = Conversation.objects.get(id=conversation_id)
    except Conversation.DoesNotExist:
        task_logger.error(f"[Coaching Task] Conversation ID {conversation_id} not found. Aborting.")
        return

    # Prerequisite: Transcription must be completed and have text
    if conversation.status_transcription != Conversation.STATUS_COMPLETED or not conversation.transcription_text:
        task_logger.warning(f"[Coaching Task] Transcription not completed or text missing for {conversation_id}. Aborting coaching.")
        if conversation.status_coaching == Conversation.STATUS_PENDING:
             conversation.status_coaching = Conversation.STATUS_FAILED
             conversation.save(update_fields=['status_coaching', 'updated_at'])
        return

    try:
        # Mark coaching as processing
        conversation.status_coaching = Conversation.STATUS_PROCESSING
        conversation.coaching_feedback = None # Clear old data
        conversation.save(update_fields=['status_coaching', 'coaching_feedback', 'updated_at'])
        task_logger.info(f"[Coaching Task] Status set to PROCESSING for Conversation ID: {conversation.id}")

        # Parse and format the stored JSON transcription
        try:
            parsed_segments = json.loads(conversation.transcription_text)
            if not isinstance(parsed_segments, list):
                raise ValueError("Parsed transcription is not a list")
            # Format into a single string for the coaching service
            formatted_transcript = "\n".join([f"Speaker {seg.get('speaker', '?')}: {seg.get('transcript', '')}" for seg in parsed_segments])
        except (json.JSONDecodeError, ValueError, TypeError) as e:
            task_logger.error(f"[Coaching Task] Failed to parse or format transcription JSON for {conversation.id}: {e}")
            raise ValueError(f"Invalid transcription format: {e}") # Propagate error

        if not formatted_transcript.strip():
             task_logger.warning(f"[Coaching Task] Formatted transcript is empty for {conversation.id}. Skipping coaching.")
             raise ValueError("Formatted transcript is empty")

        # --- Call the Coaching Service --- (Using formatted transcript)
        task_logger.info(f"[Coaching Task] Calling generate_coaching_feedback service for Conversation ID: {conversation.id}")
        feedback_result = generate_coaching_feedback(formatted_transcript)
        # --------------------------------

        if feedback_result is None:
            task_logger.error(f"[Coaching Task] Coaching service failed or returned None for {conversation.id}")
            raise ValueError("Coaching service failed")

        # Update model with results (feedback_result should be a string)
        conversation.coaching_feedback = feedback_result
        conversation.status_coaching = Conversation.STATUS_COMPLETED
        conversation.save(update_fields=['coaching_feedback', 'status_coaching', 'updated_at'])
        task_logger.info(f"[Coaching Task] Status set to COMPLETED for Conversation ID: {conversation.id}")

    except Exception as e:
        task_logger.error(f"[Coaching Task] Error during processing for Conversation ID {conversation.id}: {e}", exc_info=True)
        try:
            conversation.status_coaching = Conversation.STATUS_FAILED
            conversation.save(update_fields=['status_coaching', 'updated_at'])
            task_logger.info(f"[Coaching Task] Status set to FAILED for Conversation ID: {conversation.id}")
        except Exception as save_exc:
            task_logger.error(f"[Coaching Task] Could not mark as failed for Conversation ID {conversation.id}: {save_exc}")


# --- Interview Processing Tasks ---

@background(schedule=1)
def process_interview_transcription_task(interview_id):
    """
    Background task to process transcription for an Interview using Deepgram service.
    """
    task_logger.info(f"[Interview Transcription Task] Starting process for Interview ID: {interview_id}")
    try:
        interview = Interview.objects.get(id=interview_id)
    except Interview.DoesNotExist:
        task_logger.error(f"[Interview Transcription Task] Interview ID {interview_id} not found. Aborting.")
        return

    if not interview.audio_file or not interview.audio_file.name:
        task_logger.warning(f"[Interview Transcription Task] No audio file or file name for Interview ID: {interview.id}. Marking failed.")
        interview.status_transcription = Interview.STATUS_FAILED
        # Mark downstream tasks as failed too
        interview.status_analysis = Interview.STATUS_FAILED
        interview.status_coaching = Interview.STATUS_FAILED
        interview.save(update_fields=['status_transcription', 'status_analysis', 'status_coaching', 'updated_at'])
        return

    # Reset downstream statuses to PENDING when starting transcription
    fields_to_update = ['status_transcription']
    if interview.status_analysis != Interview.STATUS_PENDING:
        interview.status_analysis = Interview.STATUS_PENDING
        interview.analysis_json = None # Assuming analysis_json for Interview
        fields_to_update.extend(['status_analysis', 'analysis_json'])
    if interview.status_coaching != Interview.STATUS_PENDING:
        interview.status_coaching = Interview.STATUS_PENDING
        interview.coaching_json = None # Assuming coaching_json for Interview
        fields_to_update.extend(['status_coaching', 'coaching_json'])

    try:
        # Mark transcription as processing
        interview.status_transcription = Interview.STATUS_PROCESSING
        if 'updated_at' not in fields_to_update: # Ensure updated_at is included if not already
             fields_to_update.append('updated_at')
        interview.save(update_fields=fields_to_update)
        task_logger.info(f"[Interview Transcription Task] Status set to PROCESSING for Interview ID: {interview.id}")

        try:
            audio_url = interview.audio_file.url
            task_logger.info(f"[Interview Transcription Task] Audio file URL: {audio_url}")
        except Exception as url_err:
            task_logger.error(f"[Interview Transcription Task] Could not get audio file URL for {interview.id}: {url_err}")
            raise

        deepgram_options = {
            'model': 'nova-2',
            'language': 'en-US',
            'punctuate': True,
            'diarize': True, # Assuming diarization is useful for interviews
            'utterances': True,
            'smart_format': True,
        }

        service = DeepgramTranscriptionService()
        task_logger.info(f"[Interview Transcription Task] Calling Deepgram service with URL and options: {deepgram_options}")
        structured_transcription_result = service.get_full_transcript(audio_url=audio_url, **deepgram_options)

        if not structured_transcription_result:
             task_logger.warning(f"[Interview Transcription Task] Deepgram returned no result for {interview.id}. Marking failed.")
             raise ValueError("Transcription result was empty")

        interview.transcription_json = json.dumps(structured_transcription_result) # Storing as JSON string
        interview.status_transcription = Interview.STATUS_COMPLETED
        interview.save(update_fields=['transcription_json', 'status_transcription', 'updated_at'])
        task_logger.info(f"[Interview Transcription Task] Status set to COMPLETED for Interview ID: {interview.id}")

        # Trigger Analysis and Coaching Tasks
        schedule_delay = 5 # seconds
        if interview.status_analysis == Interview.STATUS_PENDING:
            task_logger.info(f"[Interview Transcription Task] Scheduling analysis task for Interview ID: {interview.id}")
            process_interview_analysis_task(interview.id, schedule=schedule_delay)
        if interview.status_coaching == Interview.STATUS_PENDING:
            task_logger.info(f"[Interview Transcription Task] Scheduling coaching task for Interview ID: {interview.id}")
            process_interview_coaching_task(interview.id, schedule=schedule_delay)

    except Exception as e:
        task_logger.error(f"[Interview Transcription Task] Error during processing for Interview ID {interview.id}: {e}", exc_info=True)
        try:
            interview.status_transcription = Interview.STATUS_FAILED
            interview.status_analysis = Interview.STATUS_FAILED
            interview.status_coaching = Interview.STATUS_FAILED
            interview.save(update_fields=['status_transcription', 'status_analysis', 'status_coaching', 'updated_at'])
            task_logger.info(f"[Interview Transcription Task] Status set to FAILED for Interview ID: {interview.id}")
        except Exception as save_exc:
            task_logger.error(f"[Interview Transcription Task] Could not mark as failed for Interview ID {interview.id}: {save_exc}")


@background(schedule=1)
def process_interview_analysis_task(interview_id):
    """
    Background task to perform analysis on an interview's transcription.
    """
    task_logger.info(f"[Interview Analysis Task] Starting process for Interview ID: {interview_id}")
    try:
        interview = Interview.objects.get(id=interview_id)
    except Interview.DoesNotExist:
        task_logger.error(f"[Interview Analysis Task] Interview ID {interview_id} not found. Aborting.")
        return

    if interview.status_transcription != Interview.STATUS_COMPLETED or not interview.transcription_json:
        task_logger.warning(f"[Interview Analysis Task] Transcription not completed or JSON missing for {interview_id}. Aborting analysis.")
        if interview.status_analysis == Interview.STATUS_PENDING:
             interview.status_analysis = Interview.STATUS_FAILED
             interview.save(update_fields=['status_analysis', 'updated_at'])
        return

    try:
        interview.status_analysis = Interview.STATUS_PROCESSING
        interview.save(update_fields=['status_analysis', 'updated_at'])
        task_logger.info(f"[Interview Analysis Task] Status set to PROCESSING for Interview ID: {interview.id}")

        try:
            # The analyze_conversation service expects a Conversation object.
            # We need to adapt this or make the service more generic.
            # For now, let's assume it can take transcription_json directly,
            # or we might need to refactor the service.
            # This is a placeholder for how the service would be called.
            # It's likely analyze_conversation needs the interview object or its relevant fields.

            parsed_transcript = json.loads(interview.transcription_json)
            # Format into a single string if needed by the service (similar to Conversation's recap input)
            # This formatting depends on what analyze_conversation expects.
            # Assuming analyze_conversation expects a raw text transcript or a specific structure.
            # For now, let's assume analyze_conversation can take the interview object and extract what it needs.
            # Or, it might need the transcript text directly.

            # Replicating how conversation's process_analysis_task prepares text:
            formatted_transcript_for_analysis = ""
            if isinstance(parsed_transcript, dict) and 'utterances' in parsed_transcript: # Deepgram specific structure
                formatted_transcript_for_analysis = "\n".join([f"Speaker {utt.get('speaker', '?')}: {utt.get('transcript', '')}" for utt in parsed_transcript['utterances']])
            elif isinstance(parsed_transcript, list): # More generic list of segments
                 formatted_transcript_for_analysis = "\n".join([f"Speaker {seg.get('speaker', '?')}: {seg.get('transcript', '')}" for seg in parsed_transcript])   
            else:
                task_logger.warning(f"[Interview Analysis Task] Transcription JSON for {interview.id} is not in expected list or dict format. Trying to use as is.")
                formatted_transcript_for_analysis = str(interview.transcription_json) # Fallback, though likely not ideal

            if not formatted_transcript_for_analysis.strip():
                task_logger.warning(f"[Interview Analysis Task] Formatted transcript is empty for {interview.id}. Skipping analysis.")
                raise ValueError("Formatted transcript for analysis is empty")

            task_logger.info(f"[Interview Analysis Task] Calling analyze_conversation service for Interview ID: {interview.id}")
            # IMPORTANT: The `analyze_conversation` service currently takes a `Conversation` object.
            # This will need to be refactored or an adapter created.
            # For now, passing the interview object, assuming the service can handle it or will be updated.
            # If analyze_conversation strictly needs a Conversation, this will fail.
            # A safer approach would be to pass only the necessary data, e.g., transcript text.
            # analysis_result = analyze_conversation(conversation=interview) # This is the ideal if service is polymorphic
            # Let's assume for now the service needs the text and questions (if any associated)
            # Mock interviews have generated_mock_questions on UserProfile, not directly on Interview object yet.
            # This part needs careful consideration of how `analyze_conversation` works.
            # For now, let's call it with formatted_transcript_for_analysis
            # And potentially, we'd need to fetch the questions associated with this interview.
            # The `analyze_conversation` in tasks.py for Conversation model uses `conversation.transcription_text` (which is JSON string of segments)
            # and `conversation.user.userprofile.generated_mock_questions`
            # The service function `analyze_conversation(conversation)` expects a conversation object.

            # To reuse `analyze_conversation`, we need to make it more generic or provide what it needs.
            # It needs:
            # 1. Transcription text (parsed and formatted)
            # 2. Mock interview questions (if applicable, from UserProfile)
            # 3. User information (for context)

            # For now, we pass the `interview` object. The service will need to be adapted.
            # This is a placeholder for the actual call which might require service modification.
            analysis_data = analyze_conversation(interview) # PASSING INTERVIEW OBJECT

            if analysis_data is None:
                task_logger.error(f"[Interview Analysis Task] Analysis service returned None for {interview.id}")
                raise ValueError("Analysis service failed")
            
            interview.analysis_json = json.dumps(analysis_data)
            interview.status_analysis = Interview.STATUS_COMPLETED
        except AttributeError as ae: # Catch if 'interview' object doesn't have an expected attr for analyze_conversation
             task_logger.error(f"[Interview Analysis Task] Attribute error calling analysis service for Interview ID {interview.id}: {ae}. This likely means the service function needs adaptation for the Interview model.", exc_info=True)
             raise
        except TypeError as te: # Catch if service function signature doesn't match
            task_logger.error(f"[Interview Analysis Task] Type error calling analysis service for Interview ID {interview.id}: {te}. This indicates the service function needs adaptation for the Interview model.", exc_info=True)
            raise
        except Exception as service_exc: # Catch other service-related errors
            task_logger.error(f"[Interview Analysis Task] Error from analysis service for Interview ID {interview.id}: {service_exc}", exc_info=True)
            raise # Re-raise to mark analysis as failed

        interview.save(update_fields=['analysis_json', 'status_analysis', 'updated_at'])
        task_logger.info(f"[Interview Analysis Task] Status set to COMPLETED for Interview ID: {interview.id}")

    except Exception as e:
        task_logger.error(f"[Interview Analysis Task] Error during processing for Interview ID {interview.id}: {e}", exc_info=True)
        try:
            interview.status_analysis = Interview.STATUS_FAILED
            interview.save(update_fields=['status_analysis', 'updated_at'])
            task_logger.info(f"[Interview Analysis Task] Status set to FAILED for Interview ID: {interview.id}")
        except Exception as save_exc:
            task_logger.error(f"[Interview Analysis Task] Could not mark as failed for Interview ID {interview.id}: {save_exc}")


@background(schedule=1)
def process_interview_coaching_task(interview_id):
    """
    Background task to generate coaching feedback for an interview.
    """
    task_logger.info(f"[Interview Coaching Task] Starting process for Interview ID: {interview_id}")
    try:
        interview = Interview.objects.get(id=interview_id)
    except Interview.DoesNotExist:
        task_logger.error(f"[Interview Coaching Task] Interview ID {interview_id} not found. Aborting.")
        return

    # Prerequisite: Transcription must be completed
    if interview.status_transcription != Interview.STATUS_COMPLETED or not interview.transcription_json:
        task_logger.warning(f"[Interview Coaching Task] Transcription not completed or JSON missing for {interview_id}. Aborting coaching.")
        if interview.status_coaching == Interview.STATUS_PENDING:
             interview.status_coaching = Interview.STATUS_FAILED
             interview.save(update_fields=['status_coaching', 'updated_at'])
        return

    # Optional Prerequisite: Analysis might be useful context for coaching
    # For now, we proceed if transcription is done, analysis is optional or can be run in parallel.
    # if interview.status_analysis != Interview.STATUS_COMPLETED or not interview.analysis_json:
    #     task_logger.warning(f"[Interview Coaching Task] Analysis not completed or JSON missing for {interview_id}. Proceeding with coaching, but context may be limited.")

    try:
        interview.status_coaching = Interview.STATUS_PROCESSING
        interview.save(update_fields=['status_coaching', 'updated_at'])
        task_logger.info(f"[Interview Coaching Task] Status set to PROCESSING for Interview ID: {interview.id}")

        try:
            # Similar to analysis, `generate_coaching_feedback` expects a `Conversation` object.
            # This will require adaptation.
            # It uses conversation.transcription_text, conversation.analysis_results, and conversation.user.userprofile.generated_mock_questions

            parsed_transcript = json.loads(interview.transcription_json)
            formatted_transcript_for_coaching = ""
            if isinstance(parsed_transcript, dict) and 'utterances' in parsed_transcript: # Deepgram specific structure
                formatted_transcript_for_coaching = "\n".join([f"Speaker {utt.get('speaker', '?')}: {utt.get('transcript', '')}" for utt in parsed_transcript['utterances']])
            elif isinstance(parsed_transcript, list): # More generic list of segments
                formatted_transcript_for_coaching = "\n".join([f"Speaker {seg.get('speaker', '?')}: {seg.get('transcript', '')}" for seg in parsed_transcript])
            else:
                task_logger.warning(f"[Interview Coaching Task] Transcription JSON for {interview.id} is not in expected list/dict format. Trying to use as is.")
                formatted_transcript_for_coaching = str(interview.transcription_json)


            if not formatted_transcript_for_coaching.strip():
                task_logger.warning(f"[Interview Coaching Task] Formatted transcript is empty for {interview.id}. Skipping coaching.")
                raise ValueError("Formatted transcript for coaching is empty")
            
            # The service `generate_coaching_feedback(conversation)` expects a conversation object.
            # We pass the interview object, assuming the service will be adapted.
            # It needs:
            # 1. Transcription text
            # 2. Analysis results (if available and used by the service)
            # 3. Mock interview questions (if applicable)
            # 4. User context
            
            task_logger.info(f"[Interview Coaching Task] Calling generate_coaching_feedback service for Interview ID: {interview.id}")
            
            # Placeholder for potential analysis data if the coaching service uses it directly
            analysis_data_for_coaching = None
            if interview.analysis_json:
                try:
                    analysis_data_for_coaching = json.loads(interview.analysis_json)
                except json.JSONDecodeError:
                    task_logger.warning(f"[Interview Coaching Task] Could not parse analysis_json for interview {interview.id}. Proceeding without it.")
            
            # This is a placeholder for the actual call which might require service modification.
            # coaching_feedback_result = generate_coaching_feedback(conversation=interview) # This is the ideal if service is polymorphic
            # For now, passing the interview object.
            coaching_feedback_result = generate_coaching_feedback(interview) # PASSING INTERVIEW OBJECT


            if coaching_feedback_result is None: # Assuming the service returns a dict/object to be JSON serialized
                task_logger.error(f"[Interview Coaching Task] Coaching service returned None for {interview.id}")
                raise ValueError("Coaching service failed")

            interview.coaching_json = json.dumps(coaching_feedback_result)
            interview.status_coaching = Interview.STATUS_COMPLETED
        except AttributeError as ae:
             task_logger.error(f"[Interview Coaching Task] Attribute error calling coaching service for Interview ID {interview.id}: {ae}. This likely means the service function needs adaptation for the Interview model.", exc_info=True)
             raise
        except TypeError as te:
            task_logger.error(f"[Interview Coaching Task] Type error calling coaching service for Interview ID {interview.id}: {te}. This indicates the service function needs adaptation for the Interview model.", exc_info=True)
            raise
        except Exception as service_exc:
            task_logger.error(f"[Interview Coaching Task] Error from coaching service for Interview ID {interview.id}: {service_exc}", exc_info=True)
            raise # Re-raise to mark coaching as failed

        interview.save(update_fields=['coaching_json', 'status_coaching', 'updated_at'])
        task_logger.info(f"[Interview Coaching Task] Status set to COMPLETED for Interview ID: {interview.id}")

    except Exception as e:
        task_logger.error(f"[Interview Coaching Task] Error during processing for Interview ID {interview.id}: {e}", exc_info=True)
        try:
            interview.status_coaching = Interview.STATUS_FAILED
            interview.save(update_fields=['status_coaching', 'updated_at'])
            task_logger.info(f"[Interview Coaching Task] Status set to FAILED for Interview ID: {interview.id}")
        except Exception as save_exc:
            task_logger.error(f"[Interview Coaching Task] Could not mark as failed for Interview ID {interview.id}: {save_exc}") 