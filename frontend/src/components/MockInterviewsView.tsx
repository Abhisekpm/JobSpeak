import React from 'react';
import FloatingActionButton from './FloatingActionButton';
// import MockInterviewSetupModal from './MockInterviewSetupModal'; // Will be needed later

const MockInterviewsView: React.FC = () => {
  // const [isModalOpen, setIsModalOpen] = React.useState(false); // State for setup modal

  const handlePracticeClick = () => {
    // setIsModalOpen(true); // Open the setup modal later
    console.log('Practice FAB clicked - will open modal later');
  };

  return (
    <div className="flex flex-col items-center justify-center h-full py-10 text-center">
      <h2 className="text-2xl font-semibold mb-4">Mock Interviews</h2>
      <p className="text-gray-600 mb-8">
        Prepare for your next job interview by practicing with AI.
      </p>
      <p className="text-gray-500">
        (Past mock interviews will appear here)
      </p>

      <FloatingActionButton onFabClick={handlePracticeClick}>
        Practice
      </FloatingActionButton>

      {/* <MockInterviewSetupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        // onStartInterview={handleStartInterview} // Function to handle starting
      /> */}
    </div>
  );
};

export default MockInterviewsView; 