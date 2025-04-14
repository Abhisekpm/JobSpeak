"""
Service layer for mock interview functionality.
Includes text extraction from files and interaction with LLMs.
"""
import os
import io
import fitz  # PyMuPDF
from docx import Document # python-docx
import google.generativeai as genai
import requests # Import requests library
from django.db import models # For FileField type hinting
from django.core.files.base import File # For type hinting on file_field object
# from django.core.files.storage import default_storage # No longer needed
# from storages.backends.s3boto3 import S3Boto3Storage # No longer needed
from django.conf import settings
from typing import List

# Configure the Gemini API key
# It's best practice to load this from environment variables
try:
    GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
    if not GOOGLE_API_KEY:
        print("Warning: GOOGLE_API_KEY environment variable not set. Mock interview generation will fail.")
        model = None
    else:
        genai.configure(api_key=GOOGLE_API_KEY)
        # Initialize the Gemini model
        # Add basic error handling for model initialization
        try:
            model = genai.GenerativeModel('gemini-1.5-pro') 
            print("Successfully initialized Google Gemini model.")
        except Exception as model_init_error:
            print(f"ERROR: Failed to initialize Google Gemini model: {model_init_error}")
            model = None

except Exception as configure_error:
    print(f"ERROR: Failed to configure Google Gemini API: {configure_error}")
    model = None

# --- Text Extraction Functions ---

def _get_file_extension(file_name: str) -> str:
    """Helper to get lowercased file extension from a filename string."""
    if not file_name:
        return ""
    return os.path.splitext(file_name)[1].lower()

def extract_text_from_file(file_field: models.FileField) -> str:
    """Extracts text from a file field (PDF or DOCX) by fetching its public URL."""
    if not file_field or not file_field.name or not hasattr(file_field, 'url'):
        raise ValueError("Invalid or empty file field provided, or URL attribute missing.")

    file_url = file_field.url
    file_name = file_field.name # Still useful for determining type and logging
    extension = _get_file_extension(file_name)

    print(f"Attempting to extract text by fetching URL: {file_url}")

    try:
        response = requests.get(file_url, stream=True, timeout=30) # Use stream=True, add timeout
        response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)

        # Get content as bytes
        file_content = response.content
        print(f"Successfully fetched {len(file_content)} bytes from {file_url}")

        if extension == '.pdf':
            return extract_text_from_pdf(file_content)
        elif extension == '.docx':
            return extract_text_from_docx(file_content)
        else:
            # Log the filename for debugging unsupported types
            print(f"Unsupported file type encountered: {file_name} (extension: {extension})")
            raise ValueError(f"Unsupported file type: {extension}. Only PDF and DOCX are supported.")

    except requests.exceptions.RequestException as e:
        # Handle connection errors, timeouts, invalid URL, etc.
        print(f"Error fetching file from URL '{file_url}': {e}")
        # Provide a user-friendly error if possible
        error_message = f"Could not retrieve file '{os.path.basename(file_name)}'. URL may be invalid or unreachable."
        if isinstance(e, requests.exceptions.HTTPError):
            error_message = f"Could not retrieve file '{os.path.basename(file_name)}'. Server returned status {e.response.status_code}."
            if e.response.status_code == 404:
                error_message = f"File '{os.path.basename(file_name)}' not found at the specified URL."
            elif e.response.status_code == 403:
                 error_message = f"Access denied when trying to retrieve file '{os.path.basename(file_name)}'. Check public access settings."
        raise ValueError(error_message) from e
    except Exception as e:
        # Catch-all for unexpected errors during processing
        print(f"Unexpected error processing file from URL '{file_url}': {e}")
        raise ValueError(f"An unexpected error occurred while processing file '{os.path.basename(file_name)}'.") from e

def extract_text_from_pdf(file_content: bytes) -> str:
    """Extracts text from PDF file content bytes."""
    try:
        doc = fitz.open(stream=file_content, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        print(f"Successfully extracted text from PDF (length: {len(text)} characters).")
        return text
    except Exception as e:
        print(f"Error extracting text from PDF bytes: {e}")
        raise ValueError(f"Failed to process PDF content: {e}") from e

def extract_text_from_docx(file_content: bytes) -> str:
    """Extracts text from DOCX file content bytes."""
    try:
        document = Document(io.BytesIO(file_content))
        text = "\n".join([para.text for para in document.paragraphs])
        print(f"Successfully extracted text from DOCX (length: {len(text)} characters).")
        return text
    except Exception as e:
        print(f"Error extracting text from DOCX bytes: {e}")
        raise ValueError(f"Failed to process DOCX content: {e}") from e

# --- Mock Interview Question Generation ---

def generate_mock_questions(resume_text: str, jd_text: str) -> List[str]:
    """
    Generates mock interview questions based on resume and job description text
    using Google Gemini Pro.
    """
    if not model:
        print("Error: Cannot generate questions, Google Gemini model not initialized.")
        # Return a user-friendly error message or raise a specific exception
        # that the view can catch and translate into a 503 Service Unavailable or similar.
        raise RuntimeError("Mock interview generation service is unavailable. Please check configuration.")
        
    prompt = f"""
    Based on the following resume and job description, generate a list of 8-10 insightful mock interview questions tailored for this specific candidate and role. The questions should primarily be behavioral or situational, probing the candidate's experience and suitability as demonstrated in their resume against the requirements listed in the job description. Avoid generic questions.

    Resume Text:
    ----------
    {resume_text}
    ----------

    Job Description Text:
    --------------------
    {jd_text}
    --------------------

    Generate the questions as a simple list, with each question on a new line, starting with the question itself (no numbering or bullet points):
    """

    try:
        print("Sending prompt to Google Gemini...")
        response = model.generate_content(prompt)
        
        questions = []
        if response.text:
            lines = response.text.strip().split('\n')
            for line in lines:
                cleaned_line = line.strip()
                if cleaned_line.startswith(('* ', '- ')): 
                    cleaned_line = cleaned_line[2:]
                elif cleaned_line and cleaned_line[0].isdigit() and (cleaned_line[1] == '.' or cleaned_line[1] == ')'): 
                    cleaned_line = '.'.join(cleaned_line.split('.')[1:]).strip()
                    cleaned_line = ')'.join(cleaned_line.split(')')[1:]).strip()
                if cleaned_line:
                    questions.append(cleaned_line)
            print(f"Received and parsed {len(questions)} questions from Gemini.")
        else:
            print("Warning: Received empty text response from Gemini.")
        
        if not questions:
             # Fallback or error if parsing failed or response was empty
             print(f"Warning: Could not parse any questions from Gemini response: {response.text}")
             return ["Could not generate interview questions at this time. Please try again later."] # User-friendly message

        return questions

    except Exception as e:
        print(f"Error calling Google Gemini API or processing response: {e}")
        # Re-raise a more specific error for the view
        raise RuntimeError(f"Failed to generate questions using the AI model: {e}") from e
