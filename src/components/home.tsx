import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import apiClient from "../lib/apiClient"; // Import the API client
import Header from "./Header";
import FloatingActionButton from "./FloatingActionButton";
import ConversationCard from "./ConversationCard";
import RecordingModal from "./RecordingModal";
import SearchFilter from "./SearchFilter"; // Import the SearchFilter component
import { Button } from "./ui/button"; // Added for error display
import { toast } from "./ui/use-toast"; // Assuming use-toast is setup (from shadcn/ui)

// Define a type for the conversation object matching the backend model/serializer
interface Conversation {
  id: number; // Django typically uses numbers for IDs
  name: string;
  created_at: string; // DRF DateTimeField usually serializes to ISO 8601 string
  updated_at: string;
  status: string;
  audio_file: string | null; // URL to the audio file
  duration: number | null; // Duration in seconds from backend
  // Add Phase 3 fields
  status_transcription: string; // e.g., 'pending', 'processing', 'completed', 'failed'
  status_transcription_display: string; // e.g., 'Pending', 'Processing', ...
  transcription_text: string | null;
}

// Define filter options structure (now matches SearchFilter)
interface FilterOptions {
  date?: string[]; // Array like ["Today", "This Month"]
  // duration removed
}

const Home = () => {
  const navigate = useNavigate();
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For initial load
  const [isSaving, setIsSaving] = useState(false); // For save operation
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(""); // State for search term
  const [activeFilters, setActiveFilters] = useState<FilterOptions>({}); // State for active filters

  // Effect to fetch conversations from the API on component mount
  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<Conversation[]>('/conversations/');
        setConversations(response.data);
      } catch (err: any) {
        console.error("Error fetching conversations:", err);
        setError("Failed to load conversations. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchConversations();
  }, []);

  // --- Handlers --- 
  
  // Handler for search input changes
  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
  };

  // Handler for filter changes from SearchFilter component
  const handleFilterChange = (newFilters: FilterOptions) => {
    setActiveFilters(newFilters);
    console.log("Active Filters Updated:", newFilters); // Log for debugging
  };

  const handleSaveRecording = async (data: { title: string; audio: Blob; duration: number }) => {
    setIsSaving(true);
    // Create FormData
    const formData = new FormData();
    formData.append('name', data.title || "Untitled Recording");
    formData.append('duration', String(Math.round(data.duration))); // Ensure duration is integer string
    // Append the audio blob with a filename
    const fileName = `${data.title || 'recording'}-${Date.now()}.wav`; // Example filename
    formData.append('audio_file', data.audio, fileName);

    try {
      // Send POST request to the backend
      const response = await apiClient.post<Conversation>('/conversations/', formData, {
        headers: {
          // Axios typically sets multipart/form-data automatically for FormData,
          // but specifying it can sometimes help avoid issues.
          'Content-Type': 'multipart/form-data',
        },
      });

      // Add the newly created conversation (from response) to the beginning of the list
      setConversations((prevConversations) => [response.data, ...prevConversations]);
      setIsRecordingModalOpen(false); // Close modal on success
      // Optionally show a success toast
      // toast({ title: "Conversation saved successfully!" });

    } catch (err: any) {
      console.error("Error saving conversation:", err);
      // Optionally show an error toast
      toast({ 
        title: "Error saving conversation", 
        description: err.response?.data?.detail || err.message || "An unknown error occurred.",
        variant: "destructive" 
      });
      // Keep the modal open if save fails, so user doesn't lose data?
      // Or add more robust error handling
    } finally {
      setIsSaving(false);
    }
  };

  const handleTitleChange = async (id: string | number, newTitle: string) => {
    // TODO: Replace with API call to PATCH /conversations/{id}/
    const originalConversations = [...conversations]; // Keep original state for potential revert
    // Optimistically update UI
    setConversations((prevConversations) =>
      prevConversations.map((conv) =>
        conv.id === id ? { ...conv, name: newTitle } : conv
      )
    );
    console.log(`Title changed for ${id} to: ${newTitle} (Optimistic UI)`);

    try {
      await apiClient.patch(`/conversations/${id}/`, { name: newTitle });
      // Optionally show success toast
      // toast({ title: "Title updated successfully!" });
    } catch (err: any) {
      console.error("Error updating title:", err);
      // Revert UI on error
      setConversations(originalConversations);
      toast({
        title: "Error updating title",
        description: err.response?.data?.detail || err.message || "Failed to save title change.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteConversation = async (id: string | number) => {
    // TODO: Replace with API call to DELETE /conversations/{id}/
    const originalConversations = [...conversations]; // Keep original state for potential revert
    // Optimistically update UI
    setConversations((prevConversations) =>
      prevConversations.filter((conv) => conv.id !== id)
    );
    console.log(`Deleted conversation ${id} (Optimistic UI)`);

    try {
      await apiClient.delete(`/conversations/${id}/`);
      // Optionally show success toast
      // toast({ title: "Conversation deleted.", variant: "destructive" });
    } catch (err: any) {
      console.error("Error deleting conversation:", err);
      // Revert UI on error
      setConversations(originalConversations);
      toast({
        title: "Error deleting conversation",
        description: err.response?.data?.detail || err.message || "Failed to delete conversation.",
        variant: "destructive"
      });
    }
  };

  const handleViewDetails = (id: string | number) => {
    navigate(`/conversation/${String(id)}`);
  };

  // Helper function to format date (can be moved to utils if needed)
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return "Invalid Date";
    }
  };
  
  // Helper function to format duration (can be moved to utils if needed)
  const formatDuration = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) return "--:--";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Helper function to create transcription preview
  const createTranscriptionPreview = (text: string | null | undefined, status: string | undefined): string => {
    if (status === 'processing' || status === 'pending') {
      return "Transcription processing...";
    }
    if (!text || text.trim() === '') {
      if (status === 'failed') {
        return "Transcription failed.";
      } else {
        return "No transcription available."; // Or maybe just empty string?
      }
    }
    const maxLength = 150; // Max characters for preview
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + "...";
  };

  // --- Filtering Logic --- 
  const filteredConversations = conversations.filter(conv => {
    // 1. Search Term Filter (Name or Transcription)
    const searchMatch = searchTerm === '' || 
                         conv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (conv.transcription_text && conv.transcription_text.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!searchMatch) return false;

    // 2. Date Filter (using checkboxes)
    if (activeFilters.date && activeFilters.date.length > 0) {
      const createdAt = new Date(conv.created_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today

      let dateMatch = false;
      for (const dateFilter of activeFilters.date) {
        let startDate: Date | null = null;
        let endDate: Date | null = null; // Use end date for ranges like This Week

        switch (dateFilter) {
          case "Today":
            startDate = new Date(today);
            endDate = new Date(today); 
            endDate.setHours(23, 59, 59, 999); // End of today
            break;
          case "This Week":
            startDate = new Date(today);
            startDate.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
             // Or Monday: startDate.setDate(today.getDate() - (today.getDay() + 6) % 7);
            endDate = new Date(startDate); 
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999); // End of week
            break;
          case "This Month":
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month
            endDate.setHours(23, 59, 59, 999);
            break;
          case "This Year":
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = new Date(today.getFullYear(), 11, 31);
            endDate.setHours(23, 59, 59, 999);
            break;
        }
        
        // Check if conversation date falls within the calculated range
        if (startDate && endDate && 
            !isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && 
            createdAt >= startDate && createdAt <= endDate) {
          dateMatch = true;
          break; // Found a match for one of the selected date filters
        }
      }
      if (!dateMatch) return false; // No selected date ranges matched
    }

    // 3. Duration Filter (Removed)
    // if (activeFilters.duration && activeFilters.duration.length > 0) { ... }

    // If all filters pass
    return true;
  });

  // --- Render Logic --- 

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header userName="Abhishek Suman" />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto mb-6">
           <SearchFilter onSearchChange={handleSearchChange} onFilter={handleFilterChange} />
        </div>
        
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">Recent Conversations</h2>

          {/* Loading State */} 
          {isLoading && (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading conversations...</p>
            </div>
          )}

          {/* Error State */} 
          {error && (
            <div className="text-center py-12 border border-dashed border-red-400 rounded-lg bg-red-50 p-4">
              <p className="text-red-600 font-medium">Error loading conversations</p>
              <p className="text-red-500 text-sm mt-2">{error}</p>
              <Button 
                variant="outline" 
                size="sm"
                className="mt-4"
                onClick={() => window.location.reload()} // Simple refresh retry
              >
                Retry
              </Button>
            </div>
          )}

          {/* Empty State (adjusted for filtering) */} 
          {!isLoading && !error && conversations.length > 0 && filteredConversations.length === 0 && (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <p className="text-gray-500">No conversations match your search "{searchTerm}".</p>
            </div>
          )}
          {!isLoading && !error && conversations.length === 0 && (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <p className="text-gray-500">No conversations yet.</p>
              <p className="text-gray-400 text-sm mt-2">
                Click the button below to start recording or uploading.
              </p>
            </div>
          )}

          {/* Data Display (uses filteredConversations) */} 
          {!isLoading && !error && filteredConversations.length > 0 && (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredConversations.map((conv) => (
                <ConversationCard
                  key={conv.id}
                  id={String(conv.id)}
                  title={conv.name}
                  date={formatDate(conv.created_at)}
                  duration={formatDuration(conv.duration)}
                  // Generate and pass the preview
                  transcriptionPreview={createTranscriptionPreview(conv.transcription_text, conv.status_transcription)}
                  onClick={() => handleViewDetails(conv.id)}
                  onDelete={() => handleDeleteConversation(conv.id)}
                  onTitleChange={handleTitleChange}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <FloatingActionButton onFabClick={() => setIsRecordingModalOpen(true)} />
      <RecordingModal
        isOpen={isRecordingModalOpen}
        onClose={() => setIsRecordingModalOpen(false)}
        onSave={handleSaveRecording}
        isSaving={isSaving} // Pass saving state to modal for potential UI feedback
      />
      {/* Add Toaster component here if using shadcn/ui toast */}
      {/* <Toaster /> */}
    </div>
  );
};

export default Home;
