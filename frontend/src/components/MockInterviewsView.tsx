import React, { useState, useEffect } from 'react';
import FloatingActionButton from './FloatingActionButton';
import MockInterviewSetupModal from './MockInterviewSetupModal';
import { Loader2 } from 'lucide-react';
import MockInterviewInterface from './MockInterviewInterface';
import InterviewCard, { Interview } from './InterviewCard';
import apiClient from '../lib/apiClient';
import { toast } from './ui/use-toast';

interface MockInterviewsViewProps {
  profileResumeUrl: string | null;
  profileJdUrl: string | null;
  fetchProfileForMockInterview: () => Promise<any>;
  isLoadingProfile: boolean;
}

// Placeholder questions for now
const DEFAULT_QUESTIONS: string[] = [
  "Tell me about yourself.",
  "Why are you interested in this role?",
  "What are your strengths?",
  "What are your weaknesses?",
  "Describe a challenging situation you faced and how you handled it."
];

const MockInterviewsView: React.FC<MockInterviewsViewProps> = ({
  profileResumeUrl,
  profileJdUrl,
  fetchProfileForMockInterview,
  isLoadingProfile,
}) => {
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [activeInterviewQuestions, setActiveInterviewQuestions] = useState<string[]>([]);
  const [pastInterviews, setPastInterviews] = useState<Interview[]>([]);
  const [isLoadingInterviews, setIsLoadingInterviews] = useState<boolean>(false);

  // Fetch past interviews
  useEffect(() => {
    const fetchPastInterviews = async () => {
      setIsLoadingInterviews(true);
      try {
        const response = await apiClient.get('/interviews/');
        setPastInterviews(response.data || []);
      } catch (error) {
        console.error("Error fetching past interviews:", error);
        toast({
          title: "Error",
          description: "Could not fetch past interviews.",
          variant: "destructive",
        });
        setPastInterviews([]); // Ensure it's an empty array on error
      }
      setIsLoadingInterviews(false);
    };

    if (!isInterviewActive) { // Only fetch when not in an active interview
      fetchPastInterviews();
    }
  }, [isInterviewActive]); // Re-fetch if isInterviewActive changes (e.g., after an interview ends)

  const handlePracticeClick = async () => {
    await fetchProfileForMockInterview();
    setIsSetupModalOpen(true);
  };

  const handleStartInterview = (
    // resumeFile: File | null, // Parameters from modal, can be used later if needed
    // jdFile: File | null,
    // jdUrl: string,
    // useExistingResume: boolean,
    // useExistingJd: boolean
  ) => {
    // For now, using default questions. Later, these could be fetched or generated.
    setActiveInterviewQuestions(DEFAULT_QUESTIONS);
    setIsSetupModalOpen(false);
    setIsInterviewActive(true);
  };

  const handleEndInterview = () => {
    setIsInterviewActive(false);
    setActiveInterviewQuestions([]); // Clear questions
    // Optionally, re-fetch interviews here if a new one was just completed and should appear
    // For now, the useEffect dependency on isInterviewActive will handle re-fetching.
  };

  const handleInterviewCardClick = (interviewId: string) => {
    // TODO: Navigate to Interview Detail Page
    console.log(`Navigate to interview detail page for ID: ${interviewId}`);
    toast({ title: "Navigation", description: `Would navigate to details for interview ${interviewId}. Not yet implemented.` });
  };

  if (isInterviewActive) {
    return <MockInterviewInterface onEndInterview={handleEndInterview} questions={activeInterviewQuestions} />;
  }

  return (
    <div className="flex flex-col items-center justify-start flex-grow py-10 px-4 md:px-8">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Mock Interviews</h2>
      <p className="text-gray-600 mb-8 max-w-lg text-center">
        Practice with AI to ace your next job interview. Upload your resume and the job description, or use your saved profile, to begin a tailored mock interview session.
      </p>

      {/* Past Interviews Section */}
      <div className="w-full max-w-4xl mt-8">
        <h3 className="text-xl font-semibold mb-4 text-gray-700">Your Past Interviews</h3>
        {isLoadingInterviews ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : pastInterviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pastInterviews.map((interview) => (
              <InterviewCard 
                key={interview.id} 
                interview={interview} 
                onClick={() => handleInterviewCardClick(interview.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-6">
            You haven't completed any mock interviews yet. Click "Practice" to start your first one!
          </p>
        )}
      </div>

      <FloatingActionButton
        onFabClick={isLoadingProfile ? () => {} : handlePracticeClick}
        className={isLoadingProfile ? "opacity-50 cursor-not-allowed" : ""}
      >
        {isLoadingProfile ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        Practice Interview
      </FloatingActionButton>

      <MockInterviewSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        onStartInterview={handleStartInterview}
        initialResumeUrl={profileResumeUrl}
        initialJdUrl={profileJdUrl}
      />
    </div>
  );
};

export default MockInterviewsView; 