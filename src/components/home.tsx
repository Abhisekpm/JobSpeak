import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import apiClient from "../lib/apiClient"; // Import the API client
import Header from "./Header";
import FloatingActionButton from "./FloatingActionButton";
import ConversationCard from "./ConversationCard";
import RecordingModal from "./RecordingModal";
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
}

const Home = () => {
  const navigate = useNavigate();
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For initial load
  const [isSaving, setIsSaving] = useState(false); // For save operation
  const [error, setError] = useState<string | null>(null);

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

  // --- Render Logic --- 

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header userName="Abhishek Suman" />
      <main className="flex-1 p-6 overflow-y-auto">
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

          {/* Empty State */} 
          {!isLoading && !error && conversations.length === 0 && (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <p className="text-gray-500">No conversations yet.</p>
              <p className="text-gray-400 text-sm mt-2">
                Click the button below to start recording or uploading.
              </p>
            </div>
          )}

          {/* Data Display */} 
          {!isLoading && !error && conversations.length > 0 && (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {conversations.map((conv) => (
                <ConversationCard
                  key={conv.id}
                  id={String(conv.id)}
                  title={conv.name}
                  date={formatDate(conv.created_at)} // Format created_at for display
                  duration={formatDuration(conv.duration)} // Use backend duration if available
                  onClick={() => handleViewDetails(conv.id)}
                  onDelete={() => handleDeleteConversation(conv.id)}
                  onTitleChange={handleTitleChange}
                  // Add transcriptionPreview later if needed
                  // transcriptionPreview={conv.transcription_preview || ""}
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
