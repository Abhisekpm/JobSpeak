import React, { useState } from 'react';
import FloatingActionButton from './FloatingActionButton';
import MockInterviewSetupModal from './MockInterviewSetupModal';
import { Loader2 } from 'lucide-react';

interface MockInterviewsViewProps {
  profileResumeUrl: string | null;
  profileJdUrl: string | null;
  fetchProfileForMockInterview: () => Promise<any>;
  isLoadingProfile: boolean;
}

const MockInterviewsView: React.FC<MockInterviewsViewProps> = ({
  profileResumeUrl,
  profileJdUrl,
  fetchProfileForMockInterview,
  isLoadingProfile,
}) => {
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  const handlePracticeClick = async () => {
    await fetchProfileForMockInterview();
    setIsSetupModalOpen(true);
  };

  const handleStartInterview = (
    resumeFile: File | null,
    jdFile: File | null,
    jdUrl: string
  ) => {
    console.log("Starting interview with:", { resumeFile, jdFile, jdUrl });
    setIsSetupModalOpen(false);
  };

  return (
    <div className="flex flex-col items-center justify-start flex-grow py-10 text-center">
      <h2 className="text-2xl font-semibold mb-4">Mock Interviews</h2>
      <p className="text-gray-600 mb-8">
        Prepare for your next job interview by practicing with AI.
        Upload your resume and the job description to get started.
      </p>
      <p className="text-gray-500">
        (Past interviews will appear here)
      </p>

      <FloatingActionButton
        onFabClick={handlePracticeClick}
        className={isLoadingProfile ? "opacity-50 cursor-not-allowed" : ""}
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
        initialResumeUrl={profileResumeUrl}
        initialJdUrl={profileJdUrl}
      />
    </div>
  );
};

export default MockInterviewsView; 