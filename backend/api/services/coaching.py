import os
import dotenv
import logging
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

dotenv.load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Configure Gemini client (Shared setup - consider centralizing)
try:
    gemini_api_key = os.environ.get('GEMINI_API_KEY')
    if not gemini_api_key:
        logging.warning("GEMINI_API_KEY environment variable not set for coaching service.")
        gemini_model = None
    else:
        genai.configure(api_key=gemini_api_key)
        # Using 1.5 Flash as default, adjust if needed for complexity or use a more powerful model
        gemini_model = genai.GenerativeModel('gemini-2.0-flash')
        logging.info("Gemini client configured successfully for coaching with model gemini-2.0-flash.")
except Exception as e:
    logging.error(f"Failed to initialize Gemini client for coaching: {e}")
    gemini_model = None # Set to None if initialization fails

# --- Function to Generate Coaching Feedback ---

def generate_coaching_feedback(transcript_text: str) -> str | None:
    """
    Analyzes the provided transcript text using the Gemini API to generate
    career coaching feedback for the job seeker.

    Args:
        transcript_text: The formatted transcript text (e.g., speaker-separated lines).

    Returns:
        A string containing the coaching feedback, or None if an error occurs.
    """
    if not gemini_model:
        logging.error("Gemini client is not initialized. Cannot generate coaching feedback.")
        return None

    if not transcript_text or not transcript_text.strip():
        logging.warning("Transcript text is empty. Cannot generate coaching feedback.")
        return None

    # --- System Prompt for Coaching ---
    system_prompt = '''
You are an Expert Career Coach. Your specialization is analyzing communication dynamics, interview performance, and professional interaction strategies, specifically within the context of job seeking.
Your Task: I will provide you with a transcript of a conversation involving a job seeker. This could be an interview, a networking call, an informational interview, or another relevant professional interaction. Your goal is to carefully review this transcript and provide constructive, actionable feedback specifically for the job seeker based only on the content provided.
Instructions for Analysis:
Role Assumption: Assume the persona of an experienced, empathetic, and insightful career coach.
Focus: Analyze the job seeker's contributions to the conversation.
Identify Strengths: Pinpoint specific examples of what the job seeker did well (e.g., clear articulation, good questions, rapport building, strong answers, handling difficult questions).
Identify Areas for Improvement: Pinpoint specific examples where the job seeker could improve (e.g., unclear answers, missed opportunities, communication style issues, lack of preparation, weak questions, poor handling of objections).
Provide Actionable Advice: For each area of improvement, offer concrete, actionable suggestions. Explain why it's an area for improvement and how the job seeker could approach it differently in the future. Provide alternative phrasing or strategies where appropriate.
Overall Impression: Briefly summarize the likely overall impression the job seeker made based on this interaction.
Constraint: Base your entire analysis and all advice strictly on the text within the transcript provided below. Do not invent context or make assumptions beyond what is explicitly stated in the conversation.
Tone: Your feedback should be constructive, supportive, professional, and geared towards empowering the job seeker to improve their performance in future interactions.
Formatting: Format the output using plain text with markdown for readability.

below is the transcript of the conversation:
'''
    # --- End of Prompt ---

    # Construct the full prompt for Gemini
    full_prompt = f"{system_prompt}\n\nConversation Transcript:\n---\n{transcript_text}\n---"

    try:
        logging.info("Sending transcript coaching request to Gemini model...")
        # Note: No specific response_mime_type needed as we expect text feedback
        response = gemini_model.generate_content(
            full_prompt,
            # Add safety settings if needed
            # safety_settings={ ... }
        )

        # Accessing the text content safely
        feedback_text = response.text if hasattr(response, 'text') else None

        if not feedback_text:
            logging.warning(f"Gemini coaching response did not contain text. Response: {response}")
            if hasattr(response, 'prompt_feedback') and response.prompt_feedback:
                logging.warning(f"Gemini prompt feedback: {response.prompt_feedback}")
            return None

        logging.info("Successfully received coaching feedback from Gemini.")
        return feedback_text.strip() # Return the feedback text

    except google_exceptions.GoogleAPIError as e:
        logging.error(f"Gemini API error during coaching feedback generation: {e}")
        return None
    except Exception as e:
        logging.error(f"An unexpected error occurred during coaching feedback generation: {e}")
        return None

# Example Usage (for testing purposes)
# if __name__ == '__main__':
#     sample_transcript = """
#     Speaker 0 (Interviewer): Thanks for coming in. Can you tell me about your experience with Python?
#     Speaker 1 (Job Seeker): Uh, yeah, I've used Python. It was... for a project.
#     Speaker 0: Okay. What kind of project?
#     Speaker 1: A web thing. Using Django. It was okay.
#     Speaker 0: Did you face any challenges?
#     Speaker 1: Yeah, sometimes the database was slow.
#     Speaker 0: I see. Do you have any questions for me?
#     Speaker 1: No, I think I'm good.
#     """
#     feedback = generate_coaching_feedback(sample_transcript)
#     if feedback:
#         print("--- Coaching Feedback ---")
#         print(feedback)
#     else:
#         print("Failed to generate coaching feedback.")
