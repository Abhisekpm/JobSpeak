import os
import dotenv
import logging
import json
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

dotenv.load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Configure Gemini client (Shared setup with recap.py/summary.py - consider centralizing)
try:
    gemini_api_key = os.environ.get('GEMINI_API_KEY')
    if not gemini_api_key:
        logging.warning("GEMINI_API_KEY environment variable not set for analysis service.")
        gemini_model = None
    else:
        genai.configure(api_key=gemini_api_key)
        # Using 1.5 Flash as default, adjust if needed for complexity
        gemini_model = genai.GenerativeModel('gemini-2.0-flash')
        logging.info("Gemini client configured successfully for analysis with model gemini-2.0-flash.")
except Exception as e:
    logging.error(f"Failed to initialize Gemini client for analysis: {e}")
    gemini_model = None # Set to None if initialization fails

# --- Function to Analyze Transcript ---

def analyze_conversation(transcript_text: str) -> dict | None:
    """
    Analyzes the provided transcript text using the Gemini API to extract
    talk time ratio, overall sentiment, and main topics.

    Args:
        transcript_text: The formatted transcript text (e.g., speaker-separated lines like "Speaker 0: ...").

    Returns:
        A dictionary containing 'talk_time_ratio', 'sentiment', and 'topics',
        or None if an error occurs or analysis fails.
    """
    if not gemini_model:
        logging.error("Gemini client is not initialized. Cannot analyze.")
        return None

    if not transcript_text or not transcript_text.strip():
        logging.warning("Transcript text is empty. Cannot analyze.")
        return None

    # --- Prompt for Analysis (Requesting JSON Output) ---
    system_prompt = '''
You are an expert conversation analyst. Given the following transcript, analyze it based on the instructions below.
Transcript format is typically lines like "Speaker X: Transcript text...".

Instructions:
1.  **Calculate Talk Time Ratio:** Estimate the approximate percentage of talk time for each speaker. Present this as a dictionary where keys are speaker labels (e.g., "Speaker 0", "Speaker 1") and values are the percentage (integer).
2.  **Determine Overall Sentiment:** Identify the overall sentiment of the conversation (e.g., Positive, Neutral, Negative). Provide a brief one-sentence reasoning for your choice.
3.  **Identify Main Topics:** List the main topics discussed in the conversation (3-5 topics maximum).

**Output Format:**
Return **ONLY** a valid JSON object containing the analysis results with the following exact keys:
- `talk_time_ratio`: Dictionary (e.g., {"Speaker 0": 60, "Speaker 1": 40})
- `sentiment`: Dictionary containing `label` (string) and `reasoning` (string).
- `topics`: List of strings.

Example JSON Output:
```json
{
  "talk_time_ratio": {
    "Speaker 0": 55,
    "Speaker 1": 45
  },
  "sentiment": {
    "label": "Neutral",
    "reasoning": "The conversation involved a mix of positive project updates and neutral planning."
  },
  "topics": [
    "Project Status Update",
    "Feature Testing Schedule",
    "Deployment Deadline"
  ]
}
```
'''
    # --- End of Prompt ---

    # Construct the full prompt for Gemini
    full_prompt = f"{system_prompt}\n\nTranscript:\n{transcript_text}"

    try:
        logging.info("Sending transcript analysis request to Gemini model...")
        response = gemini_model.generate_content(
            full_prompt,
            # Add safety settings if needed, e.g., to reduce chances of refusal for analysis
            # safety_settings={ 
            #     'HARM_CATEGORY_HATE_SPEECH': 'BLOCK_NONE', 
            #     'HARM_CATEGORY_HARASSMENT': 'BLOCK_NONE',
            #     # Add others as necessary
            # }
            generation_config=genai.types.GenerationConfig(
                # Ensure the response is treated as JSON
                response_mime_type="application/json",
            )
        )

        # Accessing the text content safely
        response_text = response.text if hasattr(response, 'text') else None

        if not response_text:
            logging.warning(f"Gemini analysis response did not contain text. Response: {response}")
            if hasattr(response, 'prompt_feedback') and response.prompt_feedback:
                logging.warning(f"Gemini prompt feedback: {response.prompt_feedback}")
            return None

        # Parse the JSON response
        try:
            analysis_result = json.loads(response_text)
            # Optional: Basic validation of the structure
            if not all(k in analysis_result for k in ["talk_time_ratio", "sentiment", "topics"]):
                 logging.error(f"Gemini analysis JSON missing required keys. Received: {response_text}")
                 return None
            if not isinstance(analysis_result["talk_time_ratio"], dict) or \
               not isinstance(analysis_result["sentiment"], dict) or \
               not isinstance(analysis_result["topics"], list):
                 logging.error(f"Gemini analysis JSON has incorrect types. Received: {response_text}")
                 return None
                 
            logging.info("Successfully received and parsed analysis from Gemini.")
            return analysis_result
        except json.JSONDecodeError as json_err:
            logging.warning(f"Initial JSON parsing failed: {json_err}. Response text: {response_text}")
            # Attempt to fix common issue: trailing comma before object/array end
            if "trailing comma" in str(json_err).lower():
                # Remove trailing commas before '}' or ']'
                import re
                # Regex to find comma before '}' or ']' possibly with whitespace
                cleaned_response_text = re.sub(r",\\s*([}\\]])", r'\\1', response_text)
                try:
                    logging.info(f"Attempting to parse cleaned JSON (removed trailing commas): {cleaned_response_text}")
                    analysis_result = json.loads(cleaned_response_text)
                    # Re-validate structure after cleaning
                    if not all(k in analysis_result for k in ["talk_time_ratio", "sentiment", "topics"]):
                         logging.error(f"Cleaned Gemini analysis JSON missing required keys. Original: {response_text}")
                         return None
                    if not isinstance(analysis_result["talk_time_ratio"], dict) or \
                       not isinstance(analysis_result["sentiment"], dict) or \
                       not isinstance(analysis_result["topics"], list):
                         logging.error(f"Cleaned Gemini analysis JSON has incorrect types. Original: {response_text}")
                         return None
                    logging.info("Successfully parsed cleaned JSON from Gemini.")
                    return analysis_result
                except json.JSONDecodeError as inner_json_err:
                    logging.error(f"Failed to parse even after attempting to remove trailing commas. Error: {inner_json_err}. Original text: {response_text}")
                    return None
            else: # If it's not a trailing comma error, log it as a more general failure
                logging.error(f"Failed to parse JSON response from Gemini analysis. Error: {json_err}. Response text: {response_text}")
                return None

    except google_exceptions.GoogleAPIError as e:
        logging.error(f"Gemini API error during analysis: {e}")
        return None
    except Exception as e:
        # Catch potential errors like InvalidArgumentError from response_mime_type if model refuses
        logging.error(f"An unexpected error occurred during analysis: {e}")
        return None

# Example Usage (for testing purposes)
# if __name__ == '__main__':
#     sample_transcript = """
#     Speaker 0: Hey, how is the project going? It feels like we are making great progress!
#     Speaker 1: Pretty well, we finished the main feature. Just need to test it now. Costs were $500.
#     Speaker 0: Great! Let's aim to deploy by Friday then. Remember the deadline is strict.
#     Speaker 1: Sounds like a plan. I'll start testing tomorrow morning. Should be straightforward.
#     Speaker 0: Excellent.
#     """
#     analysis = analyze_conversation(sample_transcript)
#     if analysis:
#         print("--- Analysis Result ---")
#         print(json.dumps(analysis, indent=2))
#     else:
#         print("Failed to generate analysis.")
