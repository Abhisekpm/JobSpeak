import os
import dotenv

from api.models import Conversation

dotenv.load_dotenv()

from groq import Groq

client = Groq(
    api_key=os.environ.get('GROQ_API_KEY'),
)

# Updated function to accept transcript and focus
def summarize_transcript(transcript_text: str, focus: int = 5):
    if not transcript_text:
        print("Warning: Cannot summarize empty transcript.")
        return None # Or raise an error, depending on desired behavior

    system_prompt = '''
    You are an advanced AI designed to summarize interview transcripts while preserving key details. Your summary should:  

    1. **Focus on the interviewee** – Highlight their insights, experiences, and key points.  
    2. **Maintain factual accuracy** – Ensure that all important values, statistics, and statements remain intact.  
    3. **Be neutral and professional** – Do not include criticism of the interviewer or interviewee.  
    4. **Adjust length based on the provided focus level (1-10)**:  
       - **1**: A very short summary (one to two sentences).  
       - **5**: A balanced summary (one paragraph).  
       - **10**: A highly detailed, multi-paragraph summary with depth but still only text. 

    ### Summary Guidelines:  
    - Retain core messages and any critical data shared by the interviewee.  
    - Exclude small talk, filler words, and irrelevant details.  
    - Use a clear and natural writing style.  
    - The output should contain **only plain text**, with no symbols, special formatting, or structured elements like key points.  
    '''

    message = f'''
    Transcript (raw): {transcript_text}

    Focus level (from 1 - 10): {focus}  
    '''
    
    try:
        chat_completion = client.chat.completions.create( # Use the global client
            model="llama-3.3-70b-versatile", # Consider making model configurable
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ]
        )
        
        summary = chat_completion.choices[0].message.content
        print(f"Successfully generated summary with focus {focus}.")
        return summary
    except Exception as e:
        print(f"Error calling Groq API for summary (focus {focus}): {e}")
        # Depending on requirements, you might want to raise the exception
        # or return None to indicate failure.
        return None