import React, { useState, useEffect } from 'react';
import { Button } from './ui/button'; // Using shadcn Button for consistency
import { Play, Pause, Mic } from 'lucide-react'; // Icons for controls

interface MockInterviewInterfaceProps {
  onEndInterview: () => void;
  // We can add props for question data, etc. later
  initialQuestion?: string; // Renamed for clarity
  // questionNumber?: number;
  // totalQuestions?: number;
  onNextQuestion?: () => Promise<string | null>; // Function to get next question
}

const MockInterviewInterface: React.FC<MockInterviewInterfaceProps> = ({
  onEndInterview,
  initialQuestion = "[Placeholder: Tell me about yourself.]",
  // questionNumber = 1,
  // totalQuestions = 5,
  onNextQuestion,
}) => {
  const [currentQuestion, setCurrentQuestion] = useState<string>(initialQuestion);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  // const [questionNumber, setQuestionNumber] = useState<number>(1); // If you want to track q number

  // Placeholder for Text-to-Speech
  const speakText = (text: string) => {
    console.log(`Speaking: ${text}`);
    // TODO: Implement actual Text-to-Speech (TTS) logic here
    // Example using Web Speech API (very basic):
    // if ('speechSynthesis' in window) {
    //   const utterance = new SpeechSynthesisUtterance(text);
    //   window.speechSynthesis.speak(utterance);
    // }
  };

  // Placeholder for Recording Logic
  const startRecording = () => {
    console.log("Recording started");
    setIsRecording(true);
    setIsPaused(false);
    // TODO: Implement actual recording start logic
  };

  const pauseRecording = () => {
    console.log("Recording paused");
    setIsPaused(true);
    // TODO: Implement actual recording pause logic
  };

  const resumeRecording = () => {
    console.log("Recording resumed");
    setIsPaused(false);
    // TODO: Implement actual recording resume logic
  };

  const stopRecording = () => {
    console.log("Recording stopped");
    setIsRecording(false);
    setIsPaused(false);
    // TODO: Implement actual recording stop logic
  };

  useEffect(() => {
    // Auto-start recording and speak the first question
    startRecording();
    speakText(currentQuestion);

    return () => {
      // Clean up recording when component unmounts
      if (isRecording) {
        stopRecording();
      }
      // Optional: stop any ongoing speech
      // if ('speechSynthesis' in window) {
      //   window.speechSynthesis.cancel();
      // }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs only once on mount

  const handleNextQuestion = async () => {
    console.log("Next Question clicked");
    if (onNextQuestion) {
      const nextQ = await onNextQuestion();
      if (nextQ) {
        setCurrentQuestion(nextQ);
        // setQuestionNumber(prev => prev + 1);
        speakText(nextQ);
      } else {
        // Handle no more questions scenario if needed
        console.log("No more questions or error fetching question.");
      }
    } else {
      // Placeholder if onNextQuestion is not provided
      const newPlaceholderQuestion = "[Placeholder: Next question...]";
      setCurrentQuestion(newPlaceholderQuestion);
      // setQuestionNumber(prev => prev + 1);
      speakText(newPlaceholderQuestion);
    }
  };

  const handleTogglePauseResume = () => {
    if (!isPaused) {
      pauseRecording();
    } else {
      resumeRecording();
    }
  };
  
  const handleEndInterviewAndRecording = () => {
    if (isRecording) {
      stopRecording();
    }
    onEndInterview();
  }

  return (
    <div className="flex flex-col items-center justify-center flex-grow py-10 text-center w-full">
      <h2 className="text-2xl font-semibold mb-4">Interview in Progress</h2>

      {isRecording && !isPaused && (
        <div className="flex items-center text-red-500 mb-4">
          <Mic className="mr-2 h-5 w-5 animate-pulse" />
          <span>Recording...</span>
        </div>
      )}
      {isRecording && isPaused && (
        <div className="flex items-center text-yellow-500 mb-4">
          <Pause className="mr-2 h-5 w-5" />
          <span>Paused</span>
        </div>
      )}
      
      <div className="p-6 border rounded-lg my-6 min-h-[120px] flex items-center justify-center bg-card shadow-md w-full max-w-lg">
        {/* <p className="text-lg text-card-foreground">Question {questionNumber} of {totalQuestions}:</p> */}
        <p className="text-xl text-card-foreground mt-2">{currentQuestion}</p>
      </div>
      
      <div className="space-x-4 mt-6 flex items-center justify-center">
        {isRecording && (
          <Button onClick={handleTogglePauseResume} variant="outline" size="icon" aria-label={isPaused ? 'Resume Recording' : 'Pause Recording'}>
            {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </Button>
        )}
        <Button onClick={handleNextQuestion} variant="outline" size="lg" disabled={!onNextQuestion && !isRecording}>
          Next Question
        </Button>
      </div>
      
      <Button 
        onClick={handleEndInterviewAndRecording} 
        variant="destructive"
        size="lg"
        className="mt-10"
      >
        End Interview
      </Button>
    </div>
  );
};

export default MockInterviewInterface; 