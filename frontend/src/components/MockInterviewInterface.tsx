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
    if (mediaStreamRef.current) {
      setIsMicrophoneReady(true);
      return true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setIsMicrophoneReady(true);
      console.log("Microphone permission granted.");
      return true;
    } catch (err) {
      console.error("Error requesting microphone permission:", err);
      setPermissionError("Microphone permission denied. Please enable it in your browser settings to record audio.");
      toast({ title: "Microphone Access Denied", description: "Please enable microphone access in your browser settings.", variant: "destructive" });
      setIsMicrophoneReady(false);
      return false;
    }
  }, [toast]);

  const startAnswerRecording = useCallback(async () => {
    if (isRecording) {
      console.log("Already recording. Call to startAnswerRecording ignored.");
      return;
    }
    if (!isMicrophoneReady) {
      const permissionGranted = await requestMicrophonePermission();
      if (!permissionGranted) return;
    }
    if (!mediaStreamRef.current) {
      toast({ title: "Error", description: "Microphone stream not available.", variant: "destructive" });
      return;
    }

    try {
      mediaRecorderRef.current = new MediaRecorder(mediaStreamRef.current);
      const newAudioBlobs: Blob[] = []; // Temporary array for current recording segment
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          newAudioBlobs.push(event.data);
        }
      };
      mediaRecorderRef.current.onstop = () => {
        console.log("Recording stopped for an answer segment.");
        // Combine all collected blobs for this segment into a single Blob
        if (newAudioBlobs.length > 0) {
          const completeAnswerBlob = new Blob(newAudioBlobs, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
          setAudioBlobs((prevBlobs) => [...prevBlobs, completeAnswerBlob]);
          // Clear newAudioBlobs for the next recording segment
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
  }, [isRecording, isMicrophoneReady, requestMicrophonePermission, toast]);

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
        console.log("Finished speaking, attempting to start recording.");
        // await startAnswerRecording();
        startAnswerRecordingRef.current && startAnswerRecordingRef.current();
      };
      audioPlayerRef.current.onerror = async (e) => {
        console.error("Error playing TTS audio:", e);
        setIsReadingQuestion(false);
        URL.revokeObjectURL(url);
        toast({ title: "TTS Playback Error", description: "Could not play the question audio.", variant: "destructive" });
        // Still attempt to start recording even if TTS fails to play, so user can answer
        if (isMicrophoneReady || await requestMicrophonePermission()) {
            // await startAnswerRecording();
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
      toast({ title: "TTS Request Error", description: errorMsg, variant: "destructive" });
      // Attempt to start recording even if TTS fetch fails
       if (isMicrophoneReady || await requestMicrophonePermission()) {
            // await startAnswerRecording();
            startAnswerRecordingRef.current && startAnswerRecordingRef.current();
        }
    }
  }, [requestMicrophonePermission, isMicrophoneReady, toast]);

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

    // Stop any ongoing recording or TTS
    if (isRecording) {
      stopAnswerRecording(); // This will trigger onstop which adds the last blob
    }
    if (audioPlayerRef.current && !audioPlayerRef.current.paused) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.src = ""; 
      audioPlayerRef.current.onended = null;
      audioPlayerRef.current.onerror = null;
    }
    setIsReadingQuestion(false);

    // Wait a brief moment to ensure the last blob is processed by onstop if recording was active
    await new Promise(resolve => setTimeout(resolve, 500)); 

    // Log current audioBlobs state just before processing
    console.log("Final audioBlobs for submission:", audioBlobs);

    if (audioBlobs.length > 0) {
      const formData = new FormData();
      const interviewName = `Mock Interview - ${new Date().toLocaleString()}`;
      formData.append('name', interviewName);

      // Append each answer audio blob as a separate file
      audioBlobs.forEach((blob, index) => {
        formData.append(`answer_audio_${index}`, blob, `answer_${index}.webm`);
        console.log(`Appended answer_audio_${index} with size: ${blob.size}`);
      });

      const questionsAnswered = questions.slice(0, currentQuestionIndex + 1);
      formData.append('questions_used', JSON.stringify(questionsAnswered));
      console.log("Questions used for submission:", questionsAnswered);

      try {
        console.log("Submitting interview data to backend...");
        const response = await apiClient.post('/api/interviews/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        console.log("Interview submission response:", response);
        toast({ title: "Interview Submitted!", description: "Your mock interview has been successfully submitted for processing.", variant: "default" });
        onEndInterview(); // Call the prop to navigate away or reset UI
      } catch (error: any) {
        console.error("Error submitting interview:", error);
        let errorMsg = "An unexpected error occurred.";
        if (error.response && error.response.data) {
          if (typeof error.response.data === 'string') {
            errorMsg = error.response.data;
          } else if (typeof error.response.data === 'object') {
            // Try to extract a meaningful message from a JSON response
            errorMsg = Object.values(error.response.data).flat().join(' ');
            if (!errorMsg) {
              try {
                errorMsg = JSON.stringify(error.response.data);
              } catch (e) { /* ignore stringify error */ }
            }
          }
        }
        toast({ title: "Submission Error", description: `Failed to submit interview: ${errorMsg}`, variant: "destructive" });
      }
    } else {
      console.log("No audio blobs recorded, ending interview without submission.");
      toast({ title: "Interview Ended", description: "No audio was recorded to submit.", variant: "default" });
      onEndInterview(); // Still call onEndInterview if nothing to submit
    }
    setIsSubmitting(false);
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