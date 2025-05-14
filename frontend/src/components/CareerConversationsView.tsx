import React from 'react';
import { Conversation, FilterOptions } from './home'; // Corrected import casing to lowercase 'home'
import SearchFilter from './SearchFilter';
import ConversationCard from './ConversationCard';
import FloatingActionButton from './FloatingActionButton';
import RecordingModal from './RecordingModal';
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
  // The main error display (if conversationError is set in Home.tsx) is handled by Home.tsx before rendering this component.
  // This component can show a loading state specifically for its content if needed,
  // but Home.tsx already has a more general loading for auth and initial conversation load.

  return (
    <>
      <SearchFilter
        onSearchChange={handleSearchChange}
        onFilter={handleFilterChange} // Make sure SearchFilter component uses 'onFilter' prop
      />
      {/* Removed searchTerm and activeFilters from props list as SearchFilter uses handlers */}
      {conversations.length === 0 && !isLoading ? (
        <div className="text-center py-10">
          <p className="text-gray-500">No conversations recorded yet.</p>
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