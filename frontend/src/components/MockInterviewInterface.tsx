import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './ui/button';
import { Play, Pause, Mic, Volume2, Loader2 as ReadingLoader, StopCircle, RadioTower } from 'lucide-react';
import { toast } from './ui/use-toast';
import apiClient from '../lib/apiClient';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface MockInterviewInterfaceProps {
  onEndInterview: () => void;
  questions: string[];
  initialQuestion?: string;
  onNextQuestion?: () => Promise<string | null>;
}

const MockInterviewInterface: React.FC<MockInterviewInterfaceProps> = ({
  onEndInterview,
  questions,
  initialQuestion,
  // onNextQuestion, // Not currently used
}) => {
  const [currentQuestion, setCurrentQuestion] = useState<string>(initialQuestion || (questions && questions.length > 0 ? questions[0] : "[Placeholder: No questions provided.]"));
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isAnswerPaused, setIsAnswerPaused] = useState<boolean>(false);
  const [audioBlobs, setAudioBlobs] = useState<Blob[]>([]);
  const audioBlobsRef = useRef<Blob[]>([]);
  const [isReadingQuestion, setIsReadingQuestion] = useState<boolean>(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isMicrophoneReady, setIsMicrophoneReady] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [initialQuestionHasBeenSpoken, setInitialQuestionHasBeenSpoken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ref to hold the latest version of startAnswerRecording callback
  const startAnswerRecordingRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    audioPlayerRef.current = new Audio();
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = "";
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const requestMicrophonePermission = useCallback(async () => {
    setPermissionError(null);

    // Check if the current stream is active and its tracks are live
    if (mediaStreamRef.current) {
      const tracks = mediaStreamRef.current.getTracks();
      const isStreamActive = mediaStreamRef.current.active;
      const areTracksLive = tracks.length > 0 && tracks.every(track => track.readyState === 'live');

      if (isStreamActive && areTracksLive) {
        console.log("Microphone stream is already active and tracks are live.");
        setIsMicrophoneReady(true);
        return true;
      } else {
        console.warn("Existing microphone stream is inactive or tracks ended. Attempting to re-acquire.");
        // Stop all tracks on the existing inactive stream before getting a new one
        tracks.forEach(track => track.stop());
        mediaStreamRef.current = null; // Clear the ref to force re-acquisition
      }
    }
    
    try {
      console.log("Requesting new microphone stream...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setIsMicrophoneReady(true);
      console.log("Microphone permission granted and stream acquired.");
      return true;
    } catch (err) {
      console.error("Error requesting microphone permission:", err);
      setPermissionError("Microphone permission denied. Please enable it in your browser settings to record audio.");
      toast({ title: "Microphone Access Denied", description: "Please enable microphone access in your browser settings.", variant: "destructive" });
      setIsMicrophoneReady(false);
      mediaStreamRef.current = null; // Ensure ref is null on error
      return false;
    }
  }, [toast]);

  const startAnswerRecording = useCallback(async () => {
    if (isRecording) {
      console.log("Already recording. Call to startAnswerRecording ignored.");
      return;
    }

    // Always ensure microphone is ready and stream is active before starting
    const permissionGranted = await requestMicrophonePermission();
    if (!permissionGranted || !mediaStreamRef.current || !mediaStreamRef.current.active) {
      toast({ title: "Error", description: "Microphone not ready or stream inactive.", variant: "destructive" });
      return;
    }
    
    try {
      console.log("MediaStream for MediaRecorder:", mediaStreamRef.current);
      if (mediaStreamRef.current) {
        console.log("MediaStream tracks:", mediaStreamRef.current.getTracks());
        mediaStreamRef.current.getTracks().forEach(track => {
          console.log(`Track readyState: ${track.readyState}, muted: ${track.muted}, enabled: ${track.enabled}`);
        });
      }
      // MODIFIED: Added mimeType option for WAV
      const mediaRecorderOptions = { mimeType: 'audio/wav' };
      try {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/wav')) {
          console.log("Attempting to use mimeType: audio/wav");
          mediaRecorderRef.current = new MediaRecorder(mediaStreamRef.current, mediaRecorderOptions);
        } else if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=pcm')) {
          console.log("audio/wav not supported, attempting audio/webm;codecs=pcm");
          mediaRecorderRef.current = new MediaRecorder(mediaStreamRef.current, { mimeType: 'audio/webm;codecs=pcm' });
        } else {
          console.warn("audio/wav and audio/webm;codecs=pcm not supported by MediaRecorder. Falling back to default (likely webm/opus).");
          mediaRecorderRef.current = new MediaRecorder(mediaStreamRef.current);
        }
      } catch (e) {
         console.warn("Error checking MediaRecorder supported types or instantiating with specific WAV/PCM mimetype, falling back to default:", e);
         mediaRecorderRef.current = new MediaRecorder(mediaStreamRef.current);
      }
      // END MODIFICATION

      const newAudioBlobs: Blob[] = []; // Temporary array for current recording segment
      mediaRecorderRef.current.ondataavailable = (event) => {
        console.log(`[MediaRecorder] ondataavailable - event.data.size: ${event.data.size}`);
        if (event.data.size > 0) {
          newAudioBlobs.push(event.data);
          console.log(`[MediaRecorder] Pushed blob of size ${event.data.size}. newAudioBlobs count: ${newAudioBlobs.length}`);
        }
      };
      mediaRecorderRef.current.onstop = () => {
        console.log("Recording stopped for an answer segment.");
        if (newAudioBlobs.length > 0) {
          // MODIFIED: Use the recorder's mimeType, default to 'audio/wav' as a fallback for the blob.
          const blobMimeType = mediaRecorderRef.current?.mimeType || 'audio/wav';
          const completeAnswerBlob = new Blob(newAudioBlobs, { type: blobMimeType });
          // Update both ref and state
          audioBlobsRef.current = [...audioBlobsRef.current, completeAnswerBlob];
          setAudioBlobs(audioBlobsRef.current);
          console.log(`[MediaRecorder] Added complete answer blob. Ref count: ${audioBlobsRef.current.length}`);
          newAudioBlobs.length = 0; 
        }
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsAnswerPaused(false);
      console.log("Answer recording started.");
    } catch (error) {
      console.error("Error starting MediaRecorder:", error);
      toast({ title: "Recording Error", description: "Could not start audio recording.", variant: "destructive" });
    }
  }, [isRecording, requestMicrophonePermission, toast]);

  // Effect to keep startAnswerRecordingRef.current up-to-date
  useEffect(() => {
    startAnswerRecordingRef.current = startAnswerRecording;
  }, [startAnswerRecording]);

  const speakText = useCallback(async (text: string) => {
    if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      // If recording is ongoing, stop it before speaking next question.
      // This ensures audio from previous answer is captured.
      mediaRecorderRef.current.stop(); // onstop will handle adding blobs
      setIsRecording(false); // Update state, though onstop also does setIsRecording(false) eventually via stopAnswerRecording if called from there
      setIsAnswerPaused(false);
    }
    
    if (!audioPlayerRef.current) {
      console.error("Audio player not initialized.");
      toast({ title: "TTS Error", description: "Audio player not ready.", variant: "destructive" });
      return;
    }
    if (!text || text.trim() === "[Placeholder: No questions provided.]" || text.trim() === "") {
      console.log("Skipping TTS for empty or placeholder text. Attempting to start recording.");
      // Attempt to start recording even if TTS is skipped for placeholder/empty
      if (isMicrophoneReady || await requestMicrophonePermission()) {
        // await startAnswerRecording();
        startAnswerRecordingRef.current && startAnswerRecordingRef.current();
      }
      return;
    }

    setIsReadingQuestion(true);
    console.log(`Requesting speech from backend for: ${text}`);

    try {
      const response = await apiClient.post('/tts/', { text }, { responseType: 'blob' });
      const audioBlob = response.data as Blob;

      if (!(audioBlob instanceof Blob) || audioBlob.size === 0) {
        throw new Error("Invalid or empty audio data received from server.");
      }
      
      const url = URL.createObjectURL(audioBlob);
      audioPlayerRef.current.src = url;
      audioPlayerRef.current.onended = async () => {
        setIsReadingQuestion(false);
        URL.revokeObjectURL(url);
        if (isSubmitting) {
          console.log("Interview submission in progress, skipping startAnswerRecording from TTS.onended");
          return;
        }
        console.log("Finished speaking, attempting to start recording.");
        startAnswerRecordingRef.current && startAnswerRecordingRef.current();
      };
      audioPlayerRef.current.onerror = async (e) => {
        console.error("Error playing TTS audio:", e);
        setIsReadingQuestion(false);
        URL.revokeObjectURL(url);
        // Don't show toast if submission is already in progress, as it might be a cleanup-related error
        if (!isSubmitting) {
            toast({ title: "TTS Playback Error", description: "Could not play the question audio.", variant: "destructive" });
        }
        
        // Still attempt to start recording even if TTS fails to play, so user can answer, but not if submitting
        if (isSubmitting) {
          console.log("Interview submission in progress, skipping startAnswerRecording from TTS.onerror");
          return;
        }
        if (isMicrophoneReady || await requestMicrophonePermission()) {
            startAnswerRecordingRef.current && startAnswerRecordingRef.current();
        }
      };
      await audioPlayerRef.current.play();

    } catch (error: any) {
      console.error("Error fetching or playing TTS from backend proxy:", error);
      setIsReadingQuestion(false);
      let errorMsg = "Failed to generate or play speech.";
      if (error.response?.data && error.response.data instanceof Blob) {
        try {
          const errorJson = JSON.parse(await error.response.data.text());
          errorMsg = errorJson.error || errorMsg;
        } catch (parseErr) { /* Blob is not JSON, stick to generic error */ }
      } else if (error.message) {
        errorMsg = error.message;
      } else if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
      }
      // Don't show toast if submission is already in progress
      if (!isSubmitting) {
        toast({ title: "TTS Request Error", description: errorMsg, variant: "destructive" });
      }
      
      // Attempt to start recording even if TTS fetch fails, but not if submitting
       if (isSubmitting) {
          console.log("Interview submission in progress, skipping startAnswerRecording from TTS.catch");
          return;
       }
       if (isMicrophoneReady || await requestMicrophonePermission()) {
            startAnswerRecordingRef.current && startAnswerRecordingRef.current();
        }
    }
  }, [requestMicrophonePermission, isMicrophoneReady, toast, isSubmitting]);

  // Speak first question when component mounts and questions are available
  useEffect(() => {
    if (questions && questions.length > 0 && currentQuestionIndex === 0 && !initialQuestionHasBeenSpoken) {
      requestMicrophonePermission(); // Request mic permission early
      speakText(questions[0]);
      setInitialQuestionHasBeenSpoken(true); // Mark that initial question has been processed
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, speakText, currentQuestionIndex, initialQuestionHasBeenSpoken, requestMicrophonePermission]); // Added dependencies

  const stopAnswerRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop(); // This will trigger ondataavailable then onstop
    }
    // onstop in startAnswerRecording now handles setAudioBlobs
    setIsRecording(false);
    setIsAnswerPaused(false);
  }, []);


  const togglePauseResumeAnswer = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    if (isAnswerPaused) {
      mediaRecorderRef.current.resume();
      setIsAnswerPaused(false);
      console.log("Answer recording resumed.");
    } else {
      mediaRecorderRef.current.pause();
      setIsAnswerPaused(true);
      console.log("Answer recording paused.");
    }
  };

  const handleNextQuestion = async () => {
    if (isReadingQuestion) {
      toast({ description: "Please wait for the question to finish reading.", variant: "default"});
      return;
    }
    if (isRecording) {
      stopAnswerRecording(); // Stop current recording, blobs are collected by onstop
    }
    
    if (audioPlayerRef.current && !audioPlayerRef.current.paused) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      setIsReadingQuestion(false); // Ensure this is reset
      if (audioPlayerRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioPlayerRef.current.src);
      }
    }

    const nextIndex = currentQuestionIndex + 1;
    if (questions && nextIndex < questions.length) {
      setCurrentQuestionIndex(nextIndex);
      setCurrentQuestion(questions[nextIndex]);
      speakText(questions[nextIndex]); // This will handle stopping current recording if any, then speak & start new one
    } else {
      console.log("No more questions in the list.");
      toast({ title: "End of Questions", description: "You have answered all available questions.", duration: 3000 });
      // Optionally, could call handleEndInterviewAndRecording automatically here or offer a button.
    }
  };
  
  const handleEndInterviewAndRecording = async () => {
    console.log("Attempting to end interview and process recordings.");
    setIsSubmitting(true);
    toast({ title: "Submitting Interview...", description: "Please wait while your interview data is being uploaded." });

    // Stop any ongoing recording
    if (isRecording) {
      stopAnswerRecording(); // This will trigger onstop which adds the last blob
    }

    // Robustly clean up the audio player
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      const currentSrc = audioPlayerRef.current.src; // Get current src before clearing/nullifying
      // Detach handlers first to prevent them from firing due to src change or other cleanup actions
      audioPlayerRef.current.onended = null;
      audioPlayerRef.current.onerror = null;
      audioPlayerRef.current.src = ""; // Clear the source
      if (currentSrc && currentSrc.startsWith('blob:')) {
          URL.revokeObjectURL(currentSrc); // Revoke the specific URL that was actually loaded
      }
    }
    setIsReadingQuestion(false);

    // Wait a brief moment to ensure the last blob is processed by onstop if recording was active
    await new Promise(resolve => setTimeout(resolve, 100));

    // Log current audioBlobs state just before processing
    console.log("Final audioBlobs for submission (from ref):", audioBlobsRef.current);

    if (audioBlobsRef.current.length > 0) {
      const formData = new FormData();
      const interviewName = `Mock Interview - ${new Date().toLocaleString()}`;
      formData.append('name', interviewName);

      // Append each answer audio blob as a separate file
      audioBlobsRef.current.forEach((blob, index) => {
        // MODIFIED: Changed file extension to .wav
        const filename = mediaRecorderRef.current?.mimeType.includes('pcm') || mediaRecorderRef.current?.mimeType.includes('wav') ? `answer_${index}.wav` : `answer_${index}.webm`;
        formData.append(`answer_audio_${index}`, blob, filename);
        console.log(`Appended ${filename} with size: ${blob.size} and type: ${blob.type}`);
      });

      console.log(`Current question index before slicing: ${currentQuestionIndex}`);
      const questionsAnswered = questions.slice(0, currentQuestionIndex + 1);
      formData.append('questions_used', JSON.stringify(questionsAnswered));
      console.log("Questions used for submission:", questionsAnswered);

      try {
        console.log("Submitting interview data to backend...");
        const response = await apiClient.post('interviews/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.status === 201) {
          toast({ title: "Success!", description: "Interview submitted successfully." });
          setAudioBlobs([]); // Clear state
          audioBlobsRef.current = []; // Clear ref
          onEndInterview(); 
        } else {
          toast({ 
            title: "Submission Error", 
            description: `Failed to submit interview. Server responded with ${response.status}.`,
            variant: "destructive" 
          });
        }
      } catch (error: any) {
        console.error("Error submitting interview:", error);
        let errorDescription = "An unknown error occurred during submission.";
        if (error.response && error.response.data) {
          // Try to get a more specific error message if available
          // This depends on how your backend formats error responses
          if (typeof error.response.data === 'string') {
            errorDescription = error.response.data;
          } else if (typeof error.response.data.detail === 'string') {
            errorDescription = error.response.data.detail;
          } else if (error.response.data.error) {
              errorDescription = typeof error.response.data.error === 'string' ? error.response.data.error : JSON.stringify(error.response.data.error);
          } else {
              try {
                  errorDescription = JSON.stringify(error.response.data);
              } catch (e) {
                  // if error.response.data is not stringifiable, use a generic message
                  errorDescription = "Could not parse error response from server.";
              }
          }
        } else if (error.message) {
          errorDescription = error.message;
        }
        toast({ 
          title: "Submission Failed", 
          description: errorDescription,
          variant: "destructive" 
        });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      console.log("No audio blobs recorded (from ref), ending interview without submission.");
      toast({ title: "Interview Ended", description: "No audio was recorded to submit.", variant: "default" });
      setAudioBlobs([]); // Clear state even if nothing to submit
      audioBlobsRef.current = []; // Clear ref even if nothing to submit
      onEndInterview(); 
    }
  };

  return (
    <div className="flex flex-col items-center justify-between flex-grow p-4 md:p-6 text-center w-full h-full bg-background">
      <div className="w-full">
        <h2 className="text-xl md:text-2xl font-semibold mb-3">Mock Interview</h2>
        {permissionError && (
            <Alert variant="destructive" className="mb-3 text-xs md:text-sm">
                <Mic className="h-4 w-4" />
                <AlertTitle>Microphone Error</AlertTitle>
                <AlertDescription>{permissionError}</AlertDescription>
            </Alert>
        )}
        {isReadingQuestion && (
          <div className="flex items-center justify-center text-blue-500 mb-3">
            <ReadingLoader className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
            <span className="text-sm md:text-base">Reading question...</span>
          </div>
        )}
        {isRecording && !isAnswerPaused && !isReadingQuestion && (
          <div className="flex items-center justify-center text-red-500 mb-3">
            <RadioTower className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-pulse" />
            <span className="text-sm md:text-base">Recording...</span>
          </div>
        )}
        {isRecording && isAnswerPaused && !isReadingQuestion && (
          <div className="flex items-center justify-center text-yellow-600 mb-3">
            <Pause className="mr-2 h-4 w-4 md:h-5 md:w-5" />
            <span className="text-sm md:text-base">Recording paused</span>
          </div>
        )}
        
        <div className="p-4 md:p-6 border rounded-lg my-4 min-h-[100px] md:min-h-[120px] flex items-center justify-center bg-card shadow-md w-full max-w-lg mx-auto">
          <p className="text-lg md:text-xl text-card-foreground">
            {isReadingQuestion ? <Volume2 className="inline h-5 w-5 md:h-6 md:w-6 mr-2 text-blue-500" /> : null} 
            {currentQuestion}
          </p>
        </div>
      </div>
      
      <div className="w-full max-w-lg mx-auto mt-auto">
        {/* Row 1: Pause/Resume and Next Question */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Button 
            onClick={togglePauseResumeAnswer} 
            size="lg" 
            variant="outline" 
            disabled={!isRecording || isReadingQuestion} 
            className="w-full"
          >
            {isAnswerPaused ? <Play className="mr-2 h-5 w-5" /> : <Pause className="mr-2 h-5 w-5" />} 
            {isAnswerPaused ? "Resume Recording" : "Pause Recording"}
          </Button>
          <Button 
            onClick={handleNextQuestion} 
            variant="outline" 
            size="lg" 
            disabled={isReadingQuestion || (questions && currentQuestionIndex >= questions.length - 1)}
            className="w-full"
          >
            Next Question
          </Button>
        </div>

        {/* Row 2: End Interview (centered) */}
        <div className="flex justify-center">
          <Button 
            onClick={handleEndInterviewAndRecording} 
            variant="destructive"
            size="lg"
            className="w-full max-w-xs" // Centered with a max width for better appearance
            disabled={isReadingQuestion} 
          >
            End Interview
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MockInterviewInterface; 