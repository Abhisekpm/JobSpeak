import React, { useState, useEffect } from 'react';
import FloatingActionButton from './FloatingActionButton';
import MockInterviewSetupModal from './MockInterviewSetupModal';
import { Loader2, X } from 'lucide-react';
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
  const [isBannerVisible, setIsBannerVisible] = useState(true);

  // Check sessionStorage on component mount to restore banner visibility state
  useEffect(() => {
    const bannerDismissed = sessionStorage.getItem('mockInterviewsBannerDismissed');
    if (bannerDismissed === 'true') {
      setIsBannerVisible(false);
    }
  }, []);

  // Handle banner dismissal with sessionStorage persistence
  const handleDismissBanner = () => {
    setIsBannerVisible(false);
    sessionStorage.setItem('mockInterviewsBannerDismissed', 'true');
  };

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

  // Handler for when a new interview is successfully created
  const handleInterviewCreated = (newInterview: Interview) => {
    console.log("New interview created, adding to list:", newInterview);
    // Add the newly created interview to the beginning of the list (same pattern as conversations)
    setPastInterviews((prevInterviews) => [
      newInterview,
      ...prevInterviews,
    ]);
  };

  const handleEndInterview = () => {
    setIsInterviewActive(false);
    setActiveInterviewQuestions([]); // Clear questions
    // Optionally, re-fetch interviews here if a new one was just completed and should appear
    // For now, the useEffect dependency on isInterviewActive will handle re-fetching.
  };

  // This handler is no longer needed as InterviewCard handles its own navigation
  // const handleInterviewCardClick = (interviewId: string) => {
  //   console.log(`Navigate to interview detail page for ID: ${interviewId}`);
  //   toast({ title: "Navigation", description: `Would navigate to details for interview ${interviewId}. Not yet implemented.` });
  // };

  if (isInterviewActive) {
    return <MockInterviewInterface onEndInterview={handleEndInterview} questions={activeInterviewQuestions} />;
  }

  return (
    <>
      {/* Styled Introductory Blurb */}
      {isBannerVisible && (
        <div className="mb-8 p-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg shadow-lg relative">
          <button
            onClick={handleDismissBanner}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-3xl font-bold mb-3 pr-8">Mock Interviews</h2>
          <p className="text-lg">
            Practice with AI to ace your next job interview. Upload your resume and the job description, or use your saved profile, to begin a tailored mock interview session.
          </p>
        </div>
      )}

      {/* Past Interviews Section */}
      <div>
        
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
                // onClick prop removed as InterviewCard handles navigation
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-gray-500">No mock interviews completed yet.</p>
            <p className="text-sm text-gray-400 mt-2">Click the button below to start your first practice session.</p>
          </div>
        )}
      </div>

      <FloatingActionButton
        onFabClick={isLoadingProfile ? () => {} : handlePracticeClick}
        className={`fixed bottom-8 right-8 ${isLoadingProfile ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {isLoadingProfile ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        Practice
      </FloatingActionButton>

      <MockInterviewSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        onStartInterview={handleStartInterview}
        onInterviewCreated={handleInterviewCreated}
        initialResumeUrl={profileResumeUrl}
        initialJdUrl={profileJdUrl}
      />
    </>
  );
};

export default MockInterviewsView; 