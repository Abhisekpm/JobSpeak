import os
import dotenv
import logging
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
import json

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
        gemini_model = genai.GenerativeModel('gemini-2.0-flash')
        logging.info("Gemini client configured successfully for coaching with model gemini-2.0-flash.")
except Exception as e:
    logging.error(f"Failed to initialize Gemini client for coaching: {e}")
    gemini_model = None

# --- Function to Generate Coaching Feedback ---

def generate_coaching_feedback(transcript_text: str) -> dict | None:
    """
    Analyzes the provided transcript text using the Gemini API to generate
    career coaching feedback for the job seeker, outputting a JSON object.

    Args:
        transcript_text: The formatted transcript text (e.g., interleaved Q&A).

    Returns:
        A dictionary containing the coaching feedback (e.g., with keys like "strengths",
        "areas_for_improvement", "actionable_advice", "overall_impression"),
        or None if an error occurs.
    """
    if not gemini_model:
        logging.error("Gemini client is not initialized. Cannot generate coaching feedback.")
        return None

    if not transcript_text or not transcript_text.strip():
        logging.warning("Transcript text is empty. Cannot generate coaching feedback.")
        return None

    system_prompt = '''
You are an Expert Career Coach. Your specialization is analyzing communication dynamics, interview performance, and professional interaction strategies, specifically within the context of job seeking and mock interviews.

Your Task:
I will provide you with a transcript of a mock interview, with questions and the job seeker's answers.
Your goal is to carefully review this transcript and provide constructive, actionable feedback specifically for the job seeker based *only* on the content provided in the transcript.

Instructions for Analysis:
Role Assumption: Assume the persona of an experienced, empathetic, and insightful career coach.
Focus: Analyze the job seeker's answers and interaction throughout the mock interview.
Identify Strengths: Pinpoint specific examples of what the job seeker did well (e.g., clear articulation, relevant examples, good STAR method usage, strong answers, confident delivery, handling difficult questions).
Identify Areas for Improvement: Pinpoint specific examples where the job seeker could improve (e.g., unclear answers, rambling, missed opportunities to showcase skills, communication style issues, lack of preparation, weak questions, poor handling of objections, answers not directly addressing the question).
Provide Actionable Advice: For each area of improvement, offer concrete, actionable suggestions. Explain *why* it's an area for improvement and *how* the job seeker could approach it differently in the future. Provide alternative phrasing or strategies where appropriate.
Overall Impression: Briefly summarize the likely overall impression the job seeker made based on this mock interview performance.
Structure the Feedback: Please provide your feedback as a structured JSON object.

**Output Format:**
Return **ONLY** a valid JSON object containing the coaching feedback with the following exact keys:
- `strengths`: A list of strings, each describing a specific strength.
- `areas_for_improvement`: A list of strings, each describing a specific area for improvement.
- `actionable_advice`: A list of dictionaries, where each dictionary has:
    - `area`: (string) The area of improvement it addresses (can be a summary or direct quote from `areas_for_improvement`).
    - `advice`: (string) Concrete advice for that area.
- `overall_impression`: A string summarizing the overall impression.

Example JSON Output:
```json
{
  "strengths": [
    "Clearly articulated experience with Python in the XYZ project.",
    "Good use of the STAR method when describing the challenge with the database."
  ],
  "areas_for_improvement": [
    "Could provide more specific details about the 'web thing' project.",
    "Appeared to lack questions for the interviewer, which can be perceived as disinterest."
  ],
  "actionable_advice": [
    {
      "area": "Could provide more specific details about the 'web thing' project.",
      "advice": "Instead of saying 'a web thing', try to specify the project's goal, your role, and key technologies used beyond Django. For example: 'It was a customer portal for e-commerce, built with Django, where I was responsible for developing the order management module.'"
    },
    {
      "area": "Appeared to lack questions for the interviewer.",
      "advice": "Always prepare 2-3 thoughtful questions about the role, team, company culture, or challenges. This shows engagement and genuine interest. For example, you could ask: 'What does a typical day look like for someone in this role?' or 'What are some of the current challenges the team is working to solve?'"
    }
  ],
  "overall_impression": "The job seeker has relevant technical skills but could improve on articulating project details and demonstrating engagement by asking questions."
}
```

Below is the transcript of the conversation:
'''
    
    full_prompt = f"{system_prompt}\n\nConversation Transcript:\n---\n{transcript_text}\n---"

    try:
        logging.info("Sending transcript coaching request to Gemini model...")
        response = gemini_model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json", # Request JSON output
            )
        )

        response_text = response.text if hasattr(response, 'text') else None

        if not response_text:
            logging.warning(f"Gemini coaching response did not contain text. Response: {response}")
            if hasattr(response, 'prompt_feedback') and response.prompt_feedback:
                logging.warning(f"Gemini prompt feedback: {response.prompt_feedback}")
            return None

        try:
            coaching_result_json = json.loads(response_text)
            if not all(k in coaching_result_json for k in ["strengths", "areas_for_improvement", "actionable_advice", "overall_impression"]):
                 logging.warning(f"Gemini coaching JSON missing one or more core keys. Received: {response_text}")
            
            logging.info("Successfully received and parsed coaching feedback JSON from Gemini.")
            return coaching_result_json
        except json.JSONDecodeError as json_err:
            logging.error(f"Failed to parse JSON response from Gemini coaching. Error: {json_err}. Response text: {response_text}")
            return None

    except google_exceptions.GoogleAPIError as e:
        logging.error(f"Gemini API error during coaching feedback generation: {e}")
        return None
    except Exception as e:
        logging.error(f"An unexpected error occurred during coaching feedback generation: {e}")
        return None

# Example Usage (for testing purposes)
# if __name__ == '__main__':
#     sample_transcript = """
#     Interviewer: Thanks for coming in. Can you tell me about your experience with Python?
#     Job Seeker: Uh, yeah, I've used Python. It was... for a project.
#     Interviewer: Okay. What kind of project?
#     Job Seeker: A web thing. Using Django. It was okay.
#     Interviewer: Did you face any challenges?
#     Job Seeker: Yeah, sometimes the database was slow.
#     Interviewer: I see. Do you have any questions for me?
#     Job Seeker: No, I think I'm good.
#     """
#     # Removed sample_analysis as it's no longer a parameter
#     feedback = generate_coaching_feedback(sample_transcript)
#     if feedback:
#         print("--- Coaching Feedback (JSON) ---")
#         print(json.dumps(feedback, indent=2))
#     else:
#         print("Failed to generate coaching feedback.")
