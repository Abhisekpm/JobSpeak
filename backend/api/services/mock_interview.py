"""
Service layer for mock interview functionality.
Includes text extraction from files and interaction with LLMs.
"""
import os
import io
# import fitz  # PyMuPDF - Replaced with pypdf
from pypdf import PdfReader # Added for PDF extraction
from docx import Document # python-docx
import google.generativeai as genai
import requests # Import requests library
from django.db import models # For FileField type hinting
from django.core.files.base import File # For type hinting on file_field object
# from django.core.files.storage import default_storage # No longer needed
# from storages.backends.s3boto3 import S3Boto3Storage # No longer needed
from django.conf import settings
from typing import List
from bs4 import BeautifulSoup # For HTML parsing
import re # For text cleaning
from urllib.parse import urlparse # For URL validation

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
    """Extracts text from PDF file content bytes using pypdf."""
    try:
        reader = PdfReader(io.BytesIO(file_content))
        text = ""
        for page in reader.pages:
            extracted_page_text = page.extract_text()
            if extracted_page_text:
                text += extracted_page_text
        print(f"Successfully extracted text from PDF using pypdf (length: {len(text)} characters).")
        return text
    except Exception as e:
        print(f"Error extracting text from PDF bytes with pypdf: {e}")
        # Consider if the original PyMuPDF error message was more specific
        # and if a more generic one is okay here.
        raise ValueError(f"Failed to process PDF content with pypdf: {e}") from e

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

def extract_text_from_url(url: str) -> str:
    """
    Extracts text content from a job posting URL.
    
    Args:
        url (str): The URL to extract text from
        
    Returns:
        str: Extracted text content
        
    Raises:
        ValueError: If URL is invalid, unreachable, or content cannot be extracted
    """
    if not url or not url.strip():
        raise ValueError("URL cannot be empty")
    
    url = url.strip()
    
    # Validate URL format
    try:
        parsed_url = urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            raise ValueError("Invalid URL format. Please include http:// or https://")
    except Exception as e:
        raise ValueError(f"Invalid URL format: {e}") from e
    
    # Set up request headers to mimic a real browser
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }
    
    print(f"Attempting to extract text from URL: {url}")
    
    try:
        response = requests.get(url, headers=headers, timeout=30, allow_redirects=True)
        response.raise_for_status()
        
        # Check if content type is HTML
        content_type = response.headers.get('content-type', '').lower()
        if 'html' not in content_type and 'text' not in content_type:
            raise ValueError(f"URL does not contain readable text content. Content type: {content_type}")
        
        print(f"Successfully fetched content from {url} (status: {response.status_code})")
        
        # Parse HTML content
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "header", "footer"]):
            script.decompose()
        
        # Try to find job description specific content areas
        job_content = None
        
        # Common selectors for job posting content
        job_selectors = [
            '[class*="job-description"]',
            '[class*="job-details"]', 
            '[class*="description"]',
            '[id*="job-description"]',
            '[id*="description"]',
            'main',
            '[role="main"]',
            '.content',
            '#content'
        ]
        
        for selector in job_selectors:
            elements = soup.select(selector)
            if elements:
                job_content = elements[0]
                print(f"Found job content using selector: {selector}")
                break
        
        # If no specific job content found, use the body
        if not job_content:
            job_content = soup.find('body')
            if not job_content:
                job_content = soup
        
        # Extract text
        text = job_content.get_text(separator='\n', strip=True)
        
        # Clean up the text
        text = _clean_extracted_text(text)
        
        if not text or len(text.strip()) < 50:
            raise ValueError("Insufficient text content extracted from URL. The page may not contain a readable job description.")
        
        print(f"Successfully extracted text from URL (length: {len(text)} characters)")
        return text
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching content from URL '{url}': {e}")
        
        if isinstance(e, requests.exceptions.HTTPError):
            status_code = e.response.status_code if e.response else "unknown"
            if status_code == 404:
                error_msg = "Job posting not found (404). The URL may be expired or incorrect."
            elif status_code == 403:
                error_msg = "Access denied (403). The website may be blocking automated access."
            elif status_code >= 500:
                error_msg = f"Website server error ({status_code}). Please try again later."
            else:
                error_msg = f"HTTP error {status_code} when accessing the URL."
        elif isinstance(e, requests.exceptions.Timeout):
            error_msg = "Request timed out. The website may be slow or unreachable."
        elif isinstance(e, requests.exceptions.ConnectionError):
            error_msg = "Could not connect to the website. Please check the URL and your internet connection."
        else:
            error_msg = f"Network error: {e}"
            
        raise ValueError(error_msg) from e
        
    except Exception as e:
        print(f"Unexpected error processing URL '{url}': {e}")
        raise ValueError(f"Failed to extract text from URL: {e}") from e

def _clean_extracted_text(text: str) -> str:
    """
    Clean and normalize extracted text content.
    
    Args:
        text (str): Raw extracted text
        
    Returns:
        str: Cleaned text
    """
    if not text:
        return ""
    
    # Replace multiple whitespace/newlines with single spaces
    text = re.sub(r'\s+', ' ', text)
    
    # Remove common unwanted patterns
    unwanted_patterns = [
        r'cookie\s+policy',
        r'privacy\s+policy', 
        r'terms\s+of\s+service',
        r'sign\s+up\s+for\s+job\s+alerts',
        r'apply\s+now',
        r'share\s+this\s+job',
        r'save\s+job',
        r'report\s+job',
        r'\b(home|about|careers|contact|help|faq)\b',
        r'follow\s+us\s+on',
        r'social\s+media',
        r'\blinkedin\b|\btwitter\b|\bfacebook\b'
    ]
    
    for pattern in unwanted_patterns:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)
    
    # Remove extra spaces and normalize
    text = ' '.join(text.split())
    
    return text.strip()

# --- Company Name Extraction ---

def extract_company_name(text: str, source_url: str = None) -> str:
    """
    Extract company name from job description text using AI.
    
    Args:
        text (str): Job description text
        source_url (str, optional): Source URL (not used, kept for compatibility)
        
    Returns:
        str: Extracted company name or fallback name
    """
    if not text or not text.strip():
        return "Unknown Company"
    
    text = text.strip()
    
    # Use AI-powered extraction
    try:
        company_from_ai = _extract_company_with_ai(text)
        if company_from_ai and company_from_ai != "Unknown Company":
            print(f"Company name extracted with AI: {company_from_ai}")
            return company_from_ai
    except Exception as e:
        print(f"Error extracting company with AI: {e}")
    
    # Fallback if AI extraction fails
    print("Could not extract company name, using fallback")
    return "Unknown Company"


def _extract_company_with_ai(text: str) -> str:
    """Extract company name using AI (Google Generative AI)."""
    if not model:
        return "Unknown Company"
    
    # Truncate text if too long (AI models have token limits)
    if len(text) > 3000:
        text = text[:3000] + "..."
    
    prompt = f"""
    Extract the company name from this job posting text. Return ONLY the company name in a clean format.
    
    Instructions:
    - Return just the company name (e.g., "Google", "Microsoft", "Apple Inc.")
    - Do not include words like "LLC" "at", "join", "company", "team", etc.
    - If you cannot identify a clear company name, return "Unknown Company"
    
    Job posting text:
    {text}
    
    Company name:"""
    
    try:
        response = model.generate_content(prompt)
        if response.text:
            company_name = response.text.strip()
            # Clean up the response
            company_name = re.sub(r'^(company name:?\s*)', '', company_name, flags=re.IGNORECASE)
            company_name = company_name.strip('"\'.,')
            
            if company_name and len(company_name.strip()) > 1 and company_name.lower() != "unknown company":
                return company_name.strip()
    
    except Exception as e:
        print(f"Error using AI for company extraction: {e}")
    
    return "Unknown Company"

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
