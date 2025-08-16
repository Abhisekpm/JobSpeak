import React, { useState, useEffect } from 'react';
import { Conversation, FilterOptions } from './Home'; // Corrected import casing to uppercase 'Home'
import SearchFilter from './SearchFilter';
import ConversationCard from './ConversationCard';
import FloatingActionButton from './FloatingActionButton';
import RecordingModal from './RecordingModal';
import { X } from 'lucide-react';
// import { Button } from './ui/button'; // Button might not be needed here anymore

// Helper function imports (or they could be moved to a utils file and imported from there)
// For now, let's assume they will be passed as props or redefined if simple enough

interface CareerConversationsViewProps {
  conversations: Conversation[];
  isLoading: boolean;
  // error: string | null; // Error handling might be kept in Home.tsx or passed
  // searchTerm: string; // Not needed if SearchFilter calls handlers directly passed from Home
  // activeFilters: FilterOptions; // Not needed if SearchFilter calls handlers directly passed from Home
  
  isRecordingModalOpen: boolean;
  setIsRecordingModalOpen: (isOpen: boolean) => void;
  isSaving: boolean;

  // Handlers
  handleSearchChange: (term: string) => void;
  handleFilterChange: (newFilters: FilterOptions) => void;
  handleViewDetails: (id: string | number) => void;
  // handleTitleChange: (id: string | number, newTitle: string) => void; // If cards are editable here
  handleSaveRecording: (data: { title: string; audio: Blob; duration: number }) => void;

  // Helper functions that might be passed or re-imported
  formatDate: (dateString: string) => string;
  formatDuration: (seconds: number | null | undefined) => string;
  createTranscriptionPreview: (conversation: Conversation) => string;
}

const CareerConversationsView: React.FC<CareerConversationsViewProps> = ({
  conversations, // These would be the already filtered conversations
  isLoading, // This is isLoadingConversations from Home.tsx
  // error,
  isRecordingModalOpen,
  setIsRecordingModalOpen,
  isSaving,
  handleSearchChange,
  handleFilterChange,
  handleViewDetails,
  handleSaveRecording,
  formatDate,
  formatDuration,
  createTranscriptionPreview,
}) => {
  const [isBannerVisible, setIsBannerVisible] = useState(true);

  // Check sessionStorage on component mount to restore banner visibility state
  useEffect(() => {
    const bannerDismissed = sessionStorage.getItem('careerConversationsBannerDismissed');
    if (bannerDismissed === 'true') {
      setIsBannerVisible(false);
    }
  }, []);

  // Handle banner dismissal with sessionStorage persistence
  const handleDismissBanner = () => {
    setIsBannerVisible(false);
    sessionStorage.setItem('careerConversationsBannerDismissed', 'true');
  };
  // The main error display (if conversationError is set in Home.tsx) is handled by Home.tsx before rendering this component.
  // This component can show a loading state specifically for its content if needed,
  // but Home.tsx already has a more general loading for auth and initial conversation load.

  return (
    <>
      {/* Introductory Blurb */}
      {isBannerVisible && (
        <div className="mb-8 p-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg shadow-lg relative">
          <button
            onClick={handleDismissBanner}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-3xl font-bold mb-3 pr-8">Career Conversations</h2>
          <p className="text-lg">
            Record your career conversations, networking calls, important discussions, or any audio you want to analyze. 
            Get transcripts, summaries, and coaching to improve your communication and recall key details.
          </p>
        </div>
      )}

      <SearchFilter
        onSearchChange={handleSearchChange}
        onFilter={handleFilterChange}
      />
      {/* Removed searchTerm and activeFilters from props list as SearchFilter uses handlers */}
      {conversations.length === 0 && !isLoading ? (
        <div className="text-center py-10">
          <p className="text-gray-500">No conversations recorded yet.</p>
          <p className="text-sm text-gray-400 mt-2">Click the button below to record your first conversation.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20 mt-8">
          {conversations.map((conv) => (
            <ConversationCard
              key={conv.id}
              id={String(conv.id)}
              title={conv.name}
              date={formatDate(conv.created_at)}
              duration={formatDuration(conv.duration)}
              previewText={createTranscriptionPreview(conv)}
              onClick={() => handleViewDetails(conv.id)}
            />
          ))}
        </div>
      )}
      <FloatingActionButton
        onFabClick={() => setIsRecordingModalOpen(true)}
      >
        Record
      </FloatingActionButton>
      <RecordingModal
        isOpen={isRecordingModalOpen}
        onClose={() => setIsRecordingModalOpen(false)}
        onSave={handleSaveRecording}
        isSaving={isSaving}
      />
    </>
  );
};

export default CareerConversationsView; 