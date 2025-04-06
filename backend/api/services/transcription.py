import time
from ..models import Conversation # Adjust import based on new location
from deepgram import DeepgramClient, PrerecordedOptions
import dotenv
import os
import json

def trigger_transcription(conversation_instance: Conversation):
    """
    Placeholder function to simulate triggering and completing transcription.
    In a real scenario, this would likely call an external API or enqueue a task.
    """
    print(f"[Transcription Service] Triggered for Conversation ID: {conversation_instance.id}")
    
    # Check if audio file exists
    if not conversation_instance.audio_file:
        print(f"[Transcription Service] No audio file found for Conversation ID: {conversation_instance.id}. Aborting.")
        conversation_instance.status_transcription = Conversation.STATUS_FAILED
        conversation_instance.save(update_fields=['status_transcription', 'updated_at'])
        return

    try:
        # 1. Update status to Processing
        conversation_instance.status_transcription = Conversation.STATUS_PROCESSING
        conversation_instance.save(update_fields=['status_transcription', 'updated_at'])
        print(f"[Transcription Service] Status set to PROCESSING for Conversation ID: {conversation_instance.id}")

        """ TRANSCRIPTION HERE"""
        transcription_service = DeepgramTranscriptionService()
        transcription = transcription_service.get_full_transcript()

        conversation_instance.transcription_text = transcription
        conversation_instance.status_transcription = Conversation.STATUS_COMPLETED
        conversation_instance.save(update_fields=['transcription_text', 'status_transcription', 'updated_at'])
        print(f"[Transcription Service] Status set to COMPLETED for Conversation ID: {conversation_instance.id}")

    except Exception as e:
        print(f"[Transcription Service] Error processing Conversation ID {conversation_instance.id}: {e}")
        conversation_instance.status_transcription = Conversation.STATUS_FAILED
        conversation_instance.save(update_fields=['status_transcription', 'updated_at'])

class DeepgramTranscriptionService:
    def __init__(self, api_key=None):
        dotenv.load_dotenv()
        self.api_key = api_key or os.getenv('DEEPGRAM_API_KEY')
        if not self.api_key:
            raise ValueError("Deepgram API key is required")
        self.client = DeepgramClient(self.api_key)
    
    def transcribe(self, audio_path, **kwargs):
        try:
            options = PrerecordedOptions(
                model=kwargs.get('model', 'nova-3'),
                language=kwargs.get('language', 'en'),
                smart_format=kwargs.get('smart_format', True),
                punctuate=kwargs.get('punctuate', True),
                utterances=kwargs.get('utterances', True),
                diarize=kwargs.get('diarize', True),
            )
            
            with open(audio_path, "rb") as audio:
                source = {"buffer": audio.read()}
                response = self.client.listen.prerecorded.v("1").transcribe_file(source, options)
            
            return response
        except Exception as e:
            print(f"Transcription error: {e}")
            raise
    
    def clean_transcription(self, response):
        words = []
        try:
            if hasattr(response, 'to_dict'):
                response_dict = response.to_dict()
            elif hasattr(response, '__dict__'):
                response_dict = response.__dict__
            else:
                response_dict = response if type(response) is dict else json.loads(response)

            if "results" in response_dict and "channels" in response_dict["results"]:
                channels = response_dict["results"]["channels"]
                for channel in channels:
                    if "alternatives" in channel:
                        alternatives = channel["alternatives"]
                        for alternative in alternatives:
                            if "words" in alternative:
                                word_data = alternative["words"]
                                for word in word_data:
                                    if "punctuated_word" in word:
                                        words.append(word["punctuated_word"])
                            else:
                                transcript = alternative.get("transcript", "")
                                if transcript:
                                    print(f"Found transcript: {transcript}")
        except Exception as e:
            print(f"Error processing transcription: {e}")
            print(f"Response type: {type(response).__name__}")
            if hasattr(response, "to_dict"):
                print("Response has to_dict method")
            
        return words
    
    def get_full_transcript(self, audio_path, **kwargs):
        response = self.transcribe(audio_path, **kwargs)
        words = self.clean_transcription(response)
        return ' '.join(words) if words else ""
