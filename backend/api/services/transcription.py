import time
from ..models import Conversation # Adjust import based on new location
from deepgram import DeepgramClient, PrerecordedOptions, FileSource, UrlSource
import dotenv
import os
import json

class DeepgramTranscriptionService:
    def __init__(self, api_key=None):
        dotenv.load_dotenv()
        self.api_key = api_key or os.getenv('DEEPGRAM_API_KEY')
        if not self.api_key:
            raise ValueError("Deepgram API key is required")
        self.client = DeepgramClient(self.api_key)
    
    def transcribe(self, audio_url: str, **kwargs):
        try:
            options = PrerecordedOptions(
                model=kwargs.get('model', 'nova-3'),
                language=kwargs.get('language', 'en-US'),
                smart_format=kwargs.get('smart_format', True),
                punctuate=kwargs.get('punctuate', True),
                utterances=kwargs.get('utterances', True),
                diarize=kwargs.get('diarize', True),
                sample_rate=kwargs.get('sample_rate'),
                channels=kwargs.get('channels')
            )
            
            source: UrlSource = {"url": audio_url}
            response = self.client.listen.prerecorded.v("1").transcribe_url(source, options)
            
            return response
        except Exception as e:
            print(f"Transcription error for URL {audio_url}: {e}")
            raise
    
    def clean_transcription(self, response):
        segments = []
        current_speaker = None
        current_transcript_words = []

        try:
            # Consolidate response handling logic if needed, assuming response_dict logic is okay
            if hasattr(response, 'to_dict'):
                response_dict = response.to_dict()
            elif hasattr(response, '__dict__'):
                response_dict = response.__dict__
            else:
                response_dict = response if type(response) is dict else json.loads(response)

            # Check structure more robustly
            words_list = response_dict.get("results", {}).get("channels", [{}])[0].get("alternatives", [{}])[0].get("words", [])

            if not words_list:
                 # Handle cases with paragraphs/utterances but no word-level detail or diarization
                transcript = response_dict.get("results", {}).get("channels", [{}])[0].get("alternatives", [{}])[0].get("transcript")
                if transcript:
                     return [{'speaker': 0, 'transcript': transcript}] # Assign a default speaker
                 # If there's absolutely no transcript found
                return []


            for word_data in words_list:
                speaker = word_data.get('speaker', 0) # Default to speaker 0 if not present
                punctuated_word = word_data.get('punctuated_word', word_data.get('word', ''))

                if current_speaker is None: # First word
                    current_speaker = speaker
                    current_transcript_words.append(punctuated_word)
                elif speaker == current_speaker: # Same speaker
                    current_transcript_words.append(punctuated_word)
                else: # Speaker change
                    # Finalize previous segment
                    if current_transcript_words:
                        segments.append({
                            "speaker": current_speaker,
                            "transcript": " ".join(current_transcript_words)
                        })
                    # Start new segment
                    current_speaker = speaker
                    current_transcript_words = [punctuated_word]

            # Add the last segment after the loop
            if current_transcript_words:
                segments.append({
                    "speaker": current_speaker,
                    "transcript": " ".join(current_transcript_words)
                })

        except Exception as e:
            print(f"Error processing transcription for speaker segmentation: {e}")
            print(f"Response type: {type(response).__name__}")
            # Basic fallback: return the whole transcript as speaker 0 if segmentation fails
            try:
                transcript = response_dict.get("results", {}).get("channels", [{}])[0].get("alternatives", [{}])[0].get("transcript")
                if transcript:
                    return [{'speaker': 0, 'transcript': transcript}]
            except Exception as fallback_e:
                 print(f"Error during fallback transcript extraction: {fallback_e}")
                 return [] # Return empty if even fallback fails

        return segments
    
    def get_full_transcript(self, audio_url: str, **kwargs):
        response = self.transcribe(audio_url=audio_url, **kwargs)
        # clean_transcription now returns the structured list of segments
        structured_transcript = self.clean_transcription(response) 
        # Return the structured data directly
        return structured_transcript
