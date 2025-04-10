import os
import dotenv
import logging
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

from api.models import Conversation

dotenv.load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Configure Gemini client
try:
    gemini_api_key = os.environ.get('GEMINI_API_KEY')
    if not gemini_api_key:
        logging.warning("GEMINI_API_KEY environment variable not set.")
        gemini_model = None
    else:
        genai.configure(api_key=gemini_api_key)
        # Use the latest available flash model
        gemini_model = genai.GenerativeModel('gemini-2.0-flash')
        logging.info("Gemini client configured successfully with model gemini-2.0-flash.")
except Exception as e:
    logging.error(f"Failed to initialize Gemini client: {e}")
    gemini_model = None # Set to None if initialization fails


# --- Function to Recap Transcript ---

def recap_interview(transcript_text: str) -> str | None:
    """
    Recaps the provided transcript text using the Gemini API based on the specific system prompt.

    Args:
        transcript_text: The formatted transcript text (e.g., speaker-separated).

    Returns:
        The recapped text as a string, or None if an error occurs.
    """
    if not gemini_model:
        logging.error("Gemini client is not initialized. Cannot recap.")
        return None

    if not transcript_text or not transcript_text.strip():
        logging.warning("Transcript text is empty. Cannot recap.")
        return None

    # --- System Prompt for Gemini ---
    # (Keeping the original prompt as it's compatible)
    system_prompt = '''
    You are an advanced AI designed to convert raw conversation transcripts into polished dialog scripts while preserving the original depth, nuance, and important information shared.
Task:
1.	Transform the transcript into a clean and detailed dialog format.
2.	Maintain all critical data, such as values, statistics, and factual statements.
3.	Infer speaker names from context where possible, using placeholders like "Speaker 1," "Client," or real names if clearly available.
4.	Remove interruptions, filler words, and off-topic chatter while preserving the flow of conversation.

Guidelines:
•	Retain the core meaning, tone, and intent of the conversation.
•	Write in a natural and conversational style suitable for a dialog script.
•	Format the output using plain text with markdown for readability (e.g., bold for speaker names, paragraph breaks between turns).
•	Do not include any additional commentary, bullet points, or summaries — only the cleaned and formatted conversation.
    
    below is the transcript of the conversation:
    '''
    # --- End of System Prompt ---

    # Construct the prompt for Gemini
    prompt = f"{system_prompt}\n\nTranscript (raw):\n{transcript_text}"

    try:
        logging.info("Sending transcript recap request to Gemini model: gemini-1.5-flash")
        # Gemini uses generate_content
        response = gemini_model.generate_content(prompt)

        # Accessing the text content safely
        recap = response.text if hasattr(response, 'text') else None

        if recap:
            logging.info("Successfully received recap from Gemini.")
            return recap
        else:
            logging.warning(f"Gemini response did not contain text. Response: {response}")
            # Attempt to check for prompt feedback if available
            if hasattr(response, 'prompt_feedback') and response.prompt_feedback:
                logging.warning(f"Gemini prompt feedback: {response.prompt_feedback}")
            return None

    except google_exceptions.GoogleAPIError as e:
        logging.error(f"Gemini API error during recap: {e}")
        return None
    except Exception as e:
        logging.error(f"An unexpected error occurred during recap: {e}")
        return None

# Example Usage (for testing purposes, typically called from tasks.py)
# if __name__ == '__main__':
#     sample_transcript = """
#     Speaker 0: Hey, how is the project going?
#     Speaker 1: Pretty well, we finished the main feature. Just need to test it now. Costs were $500.
#     Speaker 0: Great! Let's aim to deploy by Friday then. Remember the deadline is strict.
#     Speaker 1: Sounds like a plan. I'll start testing tomorrow morning.
#     """
#     recap_text = recap_interview(sample_transcript)
#     if recap_text:
#         print("--- Recap ---")
#         print(recap_text)
#     else:
#         print("Failed to generate recap.")