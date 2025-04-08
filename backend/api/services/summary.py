import os
import dotenv
import logging
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

from api.models import Conversation

dotenv.load_dotenv()

# Configure logging (using logging module is generally preferred over print for libraries/services)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Configure Gemini client (Shared setup with recap.py, consider centralizing if needed)
try:
    gemini_api_key = os.environ.get('GEMINI_API_KEY')
    if not gemini_api_key:
        logging.warning("GEMINI_API_KEY environment variable not set.")
        gemini_model = None
    else:
        genai.configure(api_key=gemini_api_key)
        # Use the latest available flash model
        gemini_model = genai.GenerativeModel('gemini-2.0-flash')
        logging.info("Gemini client configured successfully for summary with model gemini-2.0-flash.")
except Exception as e:
    logging.error(f"Failed to initialize Gemini client for summary: {e}")
    gemini_model = None # Set to None if initialization fails


# Updated function to accept transcript and focus, using Gemini
def summarize_transcript(transcript_text: str, focus: int = 5):
    if not gemini_model:
        logging.error("Gemini client is not initialized. Cannot summarize.")
        return None

    if not transcript_text:
        logging.warning("Cannot summarize empty transcript.")
        return None # Or raise an error, depending on desired behavior

    system_prompt = '''
    You are an advanced AI designed to summarize conversation transcripts while preserving key details. Your summary should:

    1. **Maintain factual accuracy** – Ensure that all important values, statistics, and statements remain intact.
    2. **Be neutral and professional** – Do not include criticism of the speakers
    3. **Adjust length based on the provided focus level (1-10)**:
       - **1**: A very short summary (one to two sentences).
       - **5**: A balanced summary (one paragraph).
       - **10**: A detailed, multi-paragraph summary with depth but still only text.

    ### Summary Guidelines:
    - Retain core messages and any critical data shared by the speakers.
    - Exclude small talk, filler words, and irrelevant details.
    - Use a clear and natural writing style.
    - The output should contain **only plain text**, with no symbols, special formatting, or structured elements like key points.
    '''

    # Construct the prompt for Gemini
    user_prompt = f'''
    Transcript (raw): {transcript_text}

    Focus level (from 1 - 10): {focus}
    '''
    full_prompt = f"{system_prompt}\n\n{user_prompt}"

    try:
        logging.info(f"Sending transcript summary request to Gemini model (Focus: {focus})")
        response = gemini_model.generate_content(full_prompt)

        # Accessing the text content safely
        summary = response.text if hasattr(response, 'text') else None

        if summary:
            logging.info(f"Successfully generated summary with focus {focus}.")
            return summary
        else:
            logging.warning(f"Gemini summary response did not contain text (Focus: {focus}). Response: {response}")
            # Attempt to check for prompt feedback if available
            if hasattr(response, 'prompt_feedback') and response.prompt_feedback:
                logging.warning(f"Gemini prompt feedback: {response.prompt_feedback}")
            return None

    except google_exceptions.GoogleAPIError as e:
        logging.error(f"Gemini API error during summary (focus {focus}): {e}")
        return None
    except Exception as e:
        logging.error(f"An unexpected error occurred during summary (focus {focus}): {e}")
        return None