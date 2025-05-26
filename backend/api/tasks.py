import time
import json # Import the json library
import logging # Import logging

from .models import Conversation, Interview
# from celery import shared_task # REMOVE THIS
from background_task import background # ADD THIS BACK

# Import the services
from .services.transcription import DeepgramTranscriptionService
from .services.recap import recap_interview # Corrected import name
from .services.summary import summarize_transcript # Import the summary service
from .services.analysis import analyze_conversation # Import the analysis service
from .services.coaching import generate_coaching_feedback # Import the coaching service
from storages.backends.s3boto3 import S3Boto3Storage

# Configure logging for tasks
task_logger = logging.getLogger('background_tasks')
task_logger.setLevel(logging.INFO)

@background(schedule=1) # REVERTED DECORATOR and added default schedule
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
        process_recap_task(conversation.id, schedule=5) # REVERTED CALL with schedule
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

@background(schedule=1) # REVERTED DECORATOR
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


@background(schedule=1) # REVERTED DECORATOR
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


@background(schedule=1) # REVERTED DECORATOR
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


@background(schedule=1) # REVERTED DECORATOR
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

@background(schedule=1) # REVERTED DECORATOR
def process_interview_transcription_task(interview_id):
    task_logger.info(f"[Interview Transcription Task] Starting process for Interview ID: {interview_id}")
    interview = None # Initialize interview to None
    try:
        interview = Interview.objects.get(id=interview_id)
    except Interview.DoesNotExist:
        task_logger.error(f"[Interview Transcription Task] Interview ID {interview_id} not found. Aborting.")
        return

    # Main try block for the entire transcription process for this interview object
    try:
        s3_keys = interview.answer_audio_s3_keys
        raw_questions_used = interview.questions_used

        if not s3_keys or not isinstance(s3_keys, list) or not s3_keys:
            task_logger.warning(f"[Interview Transcription Task] No S3 keys found for Interview ID: {interview.id}. Marking failed.")
            interview.status_transcription = Interview.STATUS_FAILED
            interview.status_analysis = Interview.STATUS_FAILED
            interview.status_coaching = Interview.STATUS_FAILED
            interview.transcription_text = "[No audio data provided for transcription]"
            interview.answer_transcripts_json = json.dumps([{"error": "No S3 keys for audio answers"}])
            interview.save(update_fields=[
                'status_transcription', 'status_analysis', 'status_coaching',
                'transcription_text', 'answer_transcripts_json', 'updated_at'
            ])
            return

        parsed_questions = [] # Initialize as an empty list
        if isinstance(raw_questions_used, list):
            parsed_questions = raw_questions_used
            task_logger.info(f"[Interview Transcription Task] 'questions_used' (ID: {interview.id}) is already a list.")
        elif isinstance(raw_questions_used, str) and raw_questions_used.strip():
            task_logger.info(f"[Interview Transcription Task] 'questions_used' (ID: {interview.id}) is a string. Attempting JSON parse.")
            try:
                loaded_data = json.loads(raw_questions_used)
                if isinstance(loaded_data, list):
                    parsed_questions = loaded_data
                else:
                    task_logger.warning(f"[Interview Transcription Task] Parsed 'questions_used' string for Interview {interview.id} is not a list (Type: {type(loaded_data)}). Using empty list.")
            except json.JSONDecodeError:
                task_logger.warning(f"[Interview Transcription Task] Failed to parse 'questions_used' string for Interview {interview.id}. Using empty list.")
        elif raw_questions_used: # It exists but is not a list or string (or is an empty string)
            task_logger.warning(f"[Interview Transcription Task] 'questions_used' for Interview {interview.id} is of unexpected type or empty string: {type(raw_questions_used)}. Using empty list.")
        else: # raw_questions_used is None or empty
            task_logger.info(f"[Interview Transcription Task] No 'questions_used' provided for Interview {interview.id}. Using empty list.")
            
        fields_to_update_on_start = ['status_transcription', 'transcription_text', 'answer_transcripts_json']
        interview.transcription_text = None
        interview.answer_transcripts_json = json.dumps([])

        if interview.status_analysis != Interview.STATUS_PENDING:
            interview.status_analysis = Interview.STATUS_PENDING
            interview.analysis_results = None
            fields_to_update_on_start.extend(['status_analysis', 'analysis_results'])
        if interview.status_coaching != Interview.STATUS_PENDING:
            interview.status_coaching = Interview.STATUS_PENDING
            interview.coaching_feedback = None
            fields_to_update_on_start.extend(['status_coaching', 'coaching_feedback'])
        
        interview.status_transcription = Interview.STATUS_PROCESSING
        fields_to_update_on_start.append('updated_at')
        interview.save(update_fields=fields_to_update_on_start)
        task_logger.info(f"[Interview Transcription Task] Status: PROCESSING for Interview ID: {interview.id}. Cleared previous results.")

        individual_structured_transcripts = []
        interleaved_qa_parts = []
        # s3_storage = S3Boto3Storage() # s3_storage.url() gives a basic URL, not necessarily presigned if objects are private
        
        # Initialize S3 client for generating presigned URLs
        # Ensure AWS settings are configured in your Django settings.py
        from django.conf import settings
        import boto3 # Make sure boto3 is installed
        s3_client = None
        try:
            s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME,
                config=boto3.session.Config(signature_version='s3v4') # Often needed for presigned URLs
            )
        except Exception as s3_client_err:
            task_logger.error(f"[Interview Transcription Task] Failed to initialize S3 client: {s3_client_err}. Aborting.")
            # Set appropriate failure status for the interview
            if interview:
                interview.status_transcription = Interview.STATUS_FAILED
                interview.transcription_text = "[S3 client initialization failed]"
                interview.answer_transcripts_json = json.dumps([{"error": "S3 client initialization failed"}])
                interview.save(update_fields=['status_transcription', 'transcription_text', 'answer_transcripts_json', 'updated_at'])
            return

        service = DeepgramTranscriptionService()
        deepgram_options = {
            'model': 'nova-2', 
            'language': 'en-US',
            'punctuate': False, 
            'diarize': False, 
            'utterances': False, 
            'smart_format': False, 
            'encoding': 'opus', # RE-ADDED for WEBM files
        }
        num_answers_to_process = len(s3_keys)

        for index, s3_key in enumerate(s3_keys):
            question_text = parsed_questions[index] if index < len(parsed_questions) else "[Question text not available]"
            interleaved_qa_parts.append(f"Question {index + 1}: {question_text}")
            task_logger.info(f"Processing answer {index + 1}/{num_answers_to_process} from S3 key: {s3_key}")
            
            answer_text_for_interleaving = "[Transcription for this answer failed or was empty]"
            current_answer_transcript_json = None
            audio_url = None # Initialize audio_url for this iteration

            try:
                if not isinstance(s3_key, str) or not s3_key.strip():
                    task_logger.warning(f"Invalid S3 key at index {index}: '{s3_key}'.")
                    raise ValueError(f"Invalid S3 key provided: {s3_key}")
                
                # audio_url = s3_storage.url(s3_key) # OLD way
                try:
                    audio_url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 'Key': s3_key},
                        ExpiresIn=3600  # URL valid for 1 hour
                    )
                    task_logger.info(f"Generated presigned Audio URL for answer {index + 1}: {audio_url}")
                except Exception as presign_err:
                    task_logger.error(f"Error generating presigned URL for S3 key {s3_key}: {presign_err}", exc_info=True)
                    # Consider this a failure for this specific audio file
                    current_answer_transcript_json = {"error": f"Failed to generate presigned URL: {str(presign_err)}"}
                    answer_text_for_interleaving = "[Failed to get audio URL]"
                    # Continue to next iteration after appending error info
                    individual_structured_transcripts.append(current_answer_transcript_json)
                    interleaved_qa_parts.append(f"Answer {index + 1}: {answer_text_for_interleaving}")
                    continue # Skip to the next S3 key

                task_logger.info(f"[DEEPGRAM_CALL] Using Audio URL: {audio_url}") # ADD THIS LOG
                structured_result = service.get_full_transcript(audio_url=audio_url, **deepgram_options)
                
                if structured_result and isinstance(structured_result, dict):
                    current_answer_transcript_json = structured_result
                    try:
                        ans_text = structured_result['results']['channels'][0]['alternatives'][0]['transcript']
                        answer_text_for_interleaving = ans_text if ans_text.strip() else "[Transcribed text was empty]"
                    except (KeyError, IndexError, TypeError) as extract_err:
                        task_logger.warning(f"Could not extract plain text from Deepgram for answer {index + 1}: {extract_err}")
                        answer_text_for_interleaving = "[Could not extract transcript text from result structure]"
                else:
                    task_logger.warning(f"Deepgram returned no or invalid result for answer {index + 1}.")
            except Exception as e:
                task_logger.error(f"Error transcribing answer {index + 1} (S3 key: {s3_key}): {e}", exc_info=True)
            
            individual_structured_transcripts.append(current_answer_transcript_json)
            interleaved_qa_parts.append(f"Answer {index + 1}: {answer_text_for_interleaving}")

        if not any(t is not None for t in individual_structured_transcripts): # If all attempts resulted in None
            task_logger.error(f"[Interview Transcription Task] All answer transcriptions effectively failed for Interview {interview.id}.")
            raise ValueError("All answer transcriptions failed. No valid transcript data obtained.")

        interview.answer_transcripts_json = json.dumps(individual_structured_transcripts)
        interview.transcription_text = "\n\n".join(interleaved_qa_parts)
        interview.status_transcription = Interview.STATUS_COMPLETED
        interview.save(update_fields=['answer_transcripts_json', 'transcription_text', 'status_transcription', 'updated_at'])
        task_logger.info(f"[Interview Transcription Task] COMPLETED for Interview ID: {interview.id}. {len(individual_structured_transcripts)} answers attempted.")

        task_logger.info(f"[Interview Transcription Task] Scheduling analysis task for Interview ID: {interview.id}")
        process_interview_analysis_task(interview.id, schedule=5) # REVERTED CALL with schedule

    except Exception as e: # This is the main exception handler for the process
        task_logger.error(f"[Interview Transcription Task] Main task FAILED for Interview ID {interview_id}: {e}", exc_info=True)
        if interview: # Check if interview object exists (it should, from the first try/except)
            try:
                interview.status_transcription = Interview.STATUS_FAILED
                interview.status_analysis = Interview.STATUS_FAILED # Also fail downstream tasks
                interview.status_coaching = Interview.STATUS_FAILED
                
                if not interview.transcription_text: # If it was never set or cleared
                    interview.transcription_text = f"[Transcription process failed: {str(e)}]"
                
                # Ensure answer_transcripts_json reflects a failure if it's empty or not set
                current_ans_transcripts_val = getattr(interview, 'answer_transcripts_json', None)
                if not current_ans_transcripts_val or current_ans_transcripts_val == json.dumps([]):
                    interview.answer_transcripts_json = json.dumps([{"error": f"Transcription process failed: {str(e)}"}])

                interview.save(update_fields=[
                    'status_transcription', 'status_analysis', 'status_coaching',
                    'transcription_text', 'answer_transcripts_json', 'updated_at'
                ])
            except Exception as save_error:
                task_logger.error(f"[Interview Transcription Task] CRITICAL: Failed to save FAILED status for Interview ID {interview_id}: {save_error}", exc_info=True)
        else:
            task_logger.error(f"[Interview Transcription Task] CRITICAL: Interview object was None when trying to save FAILED status for ID {interview_id}.")


@background(schedule=1) # REVERTED DECORATOR
def process_interview_analysis_task(interview_id):
    """
    Background task to perform analysis on a transcribed interview.
    Uses the full interleaved transcription_text.
    """
    task_logger.info(f"[Interview Analysis Task] Starting process for Interview ID: {interview_id}")
    interview = None # Initialize
    try:
        interview = Interview.objects.get(id=interview_id)
    except Interview.DoesNotExist:
        task_logger.error(f"[Interview Analysis Task] Interview ID {interview_id} not found. Aborting.")
        return

    # Main try block for the analysis process
    try:
        if interview.status_transcription != Interview.STATUS_COMPLETED or not interview.transcription_text:
            task_logger.warning(f"[Interview Analysis Task] Transcription not completed or text missing for Interview {interview.id}. Aborting analysis.")
            if interview.status_analysis == Interview.STATUS_PENDING:
                interview.status_analysis = Interview.STATUS_FAILED
                interview.status_coaching = Interview.STATUS_FAILED # Fail coaching if analysis can't run
                interview.save(update_fields=['status_analysis', 'status_coaching', 'updated_at'])
            return # Abort if prerequisites not met

        # questions_used is still relevant for context, even if not directly looped over for separate API calls here.
        if not interview.questions_used:
            task_logger.warning(f"[Interview Analysis Task] No 'questions_used' found for Interview {interview.id}, proceeding with analysis but context might be limited.")
            # Not aborting, as transcription_text is primary input for this approach.

        # Reset analysis results and set status to PROCESSING
        interview.status_analysis = Interview.STATUS_PROCESSING
        interview.analysis_results = None # Clear previous results before new processing
        interview.save(update_fields=['status_analysis', 'analysis_results', 'updated_at'])
        task_logger.info(f"[Interview Analysis Task] Status set to PROCESSING for Interview ID: {interview.id}")

        # The transcription_text should now contain the interleaved Q&A
        full_interleaved_transcript = interview.transcription_text

        if not full_interleaved_transcript or not full_interleaved_transcript.strip():
            task_logger.error(f"[Interview Analysis Task] Interleaved transcription_text is empty for Interview {interview.id}. Aborting.")
            raise ValueError("Interleaved transcription_text is empty.")

        task_logger.info(f"[Interview Analysis Task] Calling analysis service for Interview ID: {interview.id} using full interleaved transcript.")
        
        # Call the existing analyze_conversation service (or an adapted version)
        # This service expects a single block of text.
        analysis_result_content = analyze_conversation(full_interleaved_transcript)
        
        if analysis_result_content is None:
            task_logger.error(f"[Interview Analysis Task] Analysis service returned None for Interview {interview.id}")
            raise ValueError("Analysis service failed or returned None")

        interview.analysis_results = json.dumps(analysis_result_content) # Store as JSON string
        interview.status_analysis = Interview.STATUS_COMPLETED
        interview.save(update_fields=['analysis_results', 'status_analysis', 'updated_at'])
        task_logger.info(f"[Interview Analysis Task] COMPLETED for Interview ID: {interview.id}.")

        if interview.status_coaching == Interview.STATUS_PENDING:
            task_logger.info(f"[Interview Analysis Task] Scheduling coaching task for Interview ID: {interview.id}")
            process_interview_coaching_task(interview.id, schedule=5) # REVERTED CALL with schedule

    except Exception as e: # Main exception handler for the task operations
        task_logger.error(f"[Interview Analysis Task] Main task FAILED for Interview ID {interview_id}: {e}", exc_info=True)
        if interview: # Check if interview object was loaded
            try:
                interview.status_analysis = Interview.STATUS_FAILED
                interview.status_coaching = Interview.STATUS_FAILED # Also fail coaching
                if not interview.analysis_results: # Avoid overwriting if there was some partial data before error
                    interview.analysis_results = json.dumps([{"error": f"Analysis process failed: {str(e)}"}])
                interview.save(update_fields=['status_analysis', 'status_coaching', 'analysis_results', 'updated_at'])
            except Exception as save_error:
                task_logger.error(f"[Interview Analysis Task] CRITICAL: Failed to save FAILED status for Interview {interview_id}: {save_error}", exc_info=True)
        else:
            # This case should ideally not be reached if the initial fetch fails and returns.
            task_logger.error(f"[Interview Analysis Task] CRITICAL: Interview object was None when trying to handle main task failure for ID {interview_id}.")


@background(schedule=10) # REVERTED DECORATOR (keeping original schedule for this one)
def process_interview_coaching_task(interview_id):
    """
    Background task to generate coaching feedback for an interview.
    Uses the full interleaved transcription_text and the overall analysis_results.
    """
    task_logger.info(f"[Interview Coaching Task] Starting process for Interview ID: {interview_id}")
    interview = None # Initialize
    try:
        interview = Interview.objects.get(id=interview_id)
    except Interview.DoesNotExist:
        task_logger.error(f"[Interview Coaching Task] Interview ID {interview_id} not found. Aborting.")
        return

    # Main try block for the coaching process
    try:
        # Prerequisites: Analysis must be complete.
        if interview.status_analysis != Interview.STATUS_COMPLETED or not interview.analysis_results:
            task_logger.warning(f"[Interview Coaching Task] Analysis not completed or results missing for Interview {interview.id}. Aborting coaching.")
            if interview.status_coaching == Interview.STATUS_PENDING:
                interview.status_coaching = Interview.STATUS_FAILED
                interview.save(update_fields=['status_coaching', 'updated_at'])
            return # Abort if prerequisites not met

        if not interview.transcription_text:
            task_logger.warning(f"[Interview Coaching Task] Transcription text (interleaved Q&A) missing for Interview {interview.id}. Coaching quality may be affected or might fail.")
            # Decide if this is a critical failure or if coaching can proceed with only analysis_results
            # For now, let's assume it might be problematic and potentially raise an error or handle gracefully.
            # If the coaching service strictly requires the transcript, this should be a failure.

        # Reset coaching feedback and set status to PROCESSING
        interview.status_coaching = Interview.STATUS_PROCESSING
        interview.coaching_feedback = None # Clear previous results
        interview.save(update_fields=['status_coaching', 'coaching_feedback', 'updated_at'])
        task_logger.info(f"[Interview Coaching Task] Status set to PROCESSING for Interview ID: {interview.id}")

        full_interleaved_transcript = interview.transcription_text
        analysis_results_json = interview.analysis_results # This is a JSON string from the analysis task

        if not analysis_results_json:
            task_logger.error(f"[Interview Coaching Task] 'analysis_results' is empty for Interview {interview.id}. Aborting.")
            raise ValueError("'analysis_results' is empty.")
        
        try:
            parsed_analysis_results = json.loads(analysis_results_json)
        except json.JSONDecodeError as e:
            task_logger.error(f"[Interview Coaching Task] Failed to parse 'analysis_results' JSON for Interview {interview.id}: {e}")
            raise ValueError(f"Invalid JSON format for 'analysis_results': {e}")

        task_logger.info(f"[Interview Coaching Task] Calling coaching service for Interview ID: {interview.id}.")
        
        # Call the coaching service (e.g., generate_coaching_feedback)
        # Now only takes the full transcript.
        # The analysis_results are available in parsed_analysis_results if needed for any pre-check here,
        # but not passed to the coaching service itself.

        # Placeholder logic for checking analysis results before calling coaching, if desired.
        # This part is optional and depends on whether you want to gate coaching based on analysis quality.
        if isinstance(parsed_analysis_results, list) and parsed_analysis_results and "error" in parsed_analysis_results[0]:
            coaching_tips_content = {"error": "Coaching cannot proceed due to errors in prior analysis.", "details": parsed_analysis_results}
            task_logger.warning(f"[Interview Coaching Task] Coaching aborted due to errors in analysis results for Interview {interview.id}.")
        elif isinstance(parsed_analysis_results, dict) and "error" in parsed_analysis_results:
            coaching_tips_content = {"error": "Coaching cannot proceed due to errors in prior analysis.", "details": parsed_analysis_results}
            task_logger.warning(f"[Interview Coaching Task] Coaching aborted due to errors in analysis results for Interview {interview.id}.")
        else:
            # Call the simplified coaching service
            coaching_tips_content = generate_coaching_feedback(full_interleaved_transcript)
            if coaching_tips_content is None:
                 task_logger.error(f"[Interview Coaching Task] Coaching service returned None for Interview {interview.id}")
                 raise ValueError("Coaching service failed or returned None")

        interview.coaching_feedback = json.dumps(coaching_tips_content)
        interview.status_coaching = Interview.STATUS_COMPLETED
        interview.save(update_fields=['coaching_feedback', 'status_coaching', 'updated_at'])
        task_logger.info(f"[Interview Coaching Task] COMPLETED for Interview ID: {interview.id}.")

    except Exception as e: # Main exception handler for the task operations
        task_logger.error(f"[Interview Coaching Task] Main task FAILED for Interview ID {interview_id}: {e}", exc_info=True)
        if interview: # Check if interview object was loaded
            try:
                interview.status_coaching = Interview.STATUS_FAILED
                if not interview.coaching_feedback: # Avoid overwriting if there was some partial data before error
                    interview.coaching_feedback = json.dumps({"error": f"Coaching process failed: {str(e)}"})
                interview.save(update_fields=['status_coaching', 'coaching_feedback', 'updated_at'])
            except Exception as save_error:
                task_logger.error(f"[Interview Coaching Task] CRITICAL: Failed to save FAILED status for Interview {interview_id}: {save_error}", exc_info=True)
        else:
            task_logger.error(f"[Interview Coaching Task] CRITICAL: Interview object was None when trying to handle main task failure for ID {interview_id}.") 