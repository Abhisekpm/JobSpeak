import os
import dotenv

from api.models import Conversation

dotenv.load_dotenv()

from groq import Groq

client = Groq(
    api_key=os.environ.get('GROQ_API_KEY'),
)

def summerize_interview(focus=5):
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
    Transcript (raw): {self.text}

    Focus level (from 1 - 10): {focus}  
    '''

    chat_completion = self.client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},  # System instructions
            {"role": "user", "content": message}  # Actual transcript input
        ]
    )

    return chat_completion.choices[0].message.content