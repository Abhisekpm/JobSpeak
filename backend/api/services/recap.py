import os
import dotenv
import logging
from groq import Groq, GroqError

from api.models import Conversation

dotenv.load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Initialize Groq client
try:
    groq_client = Groq(
        api_key=os.environ.get('GROQ_API_KEY'),
    )
    if not os.environ.get('GROQ_API_KEY'):
         logging.warning("GROQ_API_KEY environment variable not set.")
except Exception as e:
    logging.error(f"Failed to initialize Groq client: {e}")
    groq_client = None # Set to None if initialization fails

# --- Function to Recap Transcript ---

# Make sure this model name is correct for your Groq account/plan
DEFAULT_GROQ_MODEL = "llama3-70b-8192" # Example - VERIFY THIS

# Corrected function name
def recap_interview(transcript_text: str, model: str = DEFAULT_GROQ_MODEL) -> str | None:
    """
    Recaps the provided transcript text using the Groq API based on the specific system prompt.

    Args:
        transcript_text: The formatted transcript text (e.g., speaker-separated).
        model: The Groq model to use for summarization.

    Returns:
        The recapped text as a string, or None if an error occurs.
    """
    if not groq_client:
        logging.error("Groq client is not initialized. Cannot summarize.")
        return None

    if not transcript_text or not transcript_text.strip():
        logging.warning("Transcript text is empty. Cannot summarize.")
        return None

    # --- User's Original System Prompt ---
    system_prompt = '''
    You are an advanced AI designed to recap conversation transcripts while preserving details. Your recap should:

    1. Give the conversation in a detailed dialog format after cleaning up the transcript. maintain the depth of the conversation and the details.
    2. **Maintain factual accuracy** – Ensure that all important values, statistics, and statements remain intact.

    ### Recap Guidelines:
    - Retain core messages and any critical data shared in the conversation.
    - Use a clear and natural writing style.
    - The output should contain **only plain text**, with no symbols, special formatting, or structured elements like key points.
    '''
    # --- End of User's Original System Prompt ---


    # User message containing the transcript - Using the required 'text' variable name from the original code snippet
    # Ensure the input 'transcript_text' is used correctly here.
    user_message = f'Transcript (raw): {transcript_text}' # Use the function parameter

    try:
        logging.info(f"Sending transcript recap request to Groq model: {model}")
        chat_completion = groq_client.chat.completions.create(
            model=model, # Use the verified model name
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            # Optional: Add temperature, max_tokens etc. if needed
        )

        recap = chat_completion.choices[0].message.content
        logging.info("Successfully received recap from Groq.")
        # Return the raw content as requested by the prompt (plain text)
        return recap if recap else None

    except GroqError as e:
        logging.error(f"Groq API error during recap: {e}")
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
#     # Assume sample_transcript is formatted appropriately before passing
#     summary = summarize_interview(sample_transcript)
#     if summary:
#         print("--- Recap ---")
#         print(summary)
#     else:
#         print("Failed to generate recap.")