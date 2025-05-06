import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import apiClient from "../lib/apiClient"; // Import the API client
import FloatingActionButton from "./FloatingActionButton";
import ConversationCard from "./ConversationCard";
import RecordingModal from "./RecordingModal";
import SearchFilter from "./SearchFilter"; // Import the SearchFilter component
import { Button } from "./ui/button"; // Added for error display
import { toast } from "./ui/use-toast"; // Assuming use-toast is setup (from shadcn/ui)
import { useAuth } from "../contexts/AuthContext"; // <-- Corrected path

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
  transcription_text: unknown | null;
  // Add Recap/Summary fields (matching ConversationDetail)
  status_recap: string;
  status_recap_display: string;
  recap_text: string | null;
  status_summary: string;
  status_summary_display: string;
  summary_data: {
    short: string | null;
    balanced: string | null;
    detailed: string | null;
  } | null;
}

// Define filter options structure (now matches SearchFilter)
interface FilterOptions {
  date?: string[]; // Array like ["Today", "This Month"]
  // duration removed
}

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, loading } = useAuth(); // Access auth state
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For initial load
  const [isSaving, setIsSaving] = useState(false); // For save operation
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(""); // State for search term
  const [activeFilters, setActiveFilters] = useState<FilterOptions>({}); // State for active filters

  // Effect to fetch conversations from the API on component mount
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      navigate("/login"); // Redirect to login if not authenticated
      return;
    }

    const fetchConversations = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<Conversation[]>("/conversations/");
        setConversations(response.data);
      } catch (err: any) {
        console.error("Error fetching conversations:", err);
        setError("Failed to load conversations. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchConversations();
    }
  }, [isAuthenticated, loading, navigate]);

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

  const handleSaveRecording = async (data: {
    title: string;
    audio: Blob;
    duration: number;
  }) => {
    setIsSaving(true);
    // Create FormData
    const formData = new FormData();
    formData.append("name", data.title || "Untitled Recording");
    formData.append("duration", String(Math.round(data.duration))); // Ensure duration is integer string
    // Append the audio blob with a filename
    const fileName = `${data.title || "recording"}-${Date.now()}.wav`; // Example filename
    formData.append("audio_file", data.audio, fileName);

    try {
      // Send POST request to the backend
      const response = await apiClient.post<Conversation>(
        "/conversations/",
        formData,
        {
          headers: {
            // Axios typically sets multipart/form-data automatically for FormData,
            // but specifying it can sometimes help avoid issues.
            "Content-Type": "multipart/form-data",
          },
        }
      );

      // Add the newly created conversation (from response) to the beginning of the list
      setConversations((prevConversations) => [
        response.data,
        ...prevConversations,
      ]);
      setIsRecordingModalOpen(false); // Close modal on success
      // Optionally show a success toast
      // toast({ title: "Conversation saved successfully!" });
    } catch (err: any) {
      console.error("Error saving conversation:", err);
      // Optionally show an error toast
      toast({
        title: "Error saving conversation",
        description:
          err.response?.data?.detail ||
          err.message ||
          "An unknown error occurred.",
        variant: "destructive",
      });
      // Keep the modal open if save fails, so user doesn't lose data?
      // Or add more robust error handling
    } finally {
      setIsSaving(false);
    }
  };

  const handleTitleChange = async (id: string | number, newTitle: string) => {
    if (!newTitle.trim()) {
      toast({
        title: "Invalid title",
        description: "Title cannot be empty",
        variant: "destructive",
      });
      return;
    }

    const originalConversations = [...conversations]; // Keep original state for potential revert
    // Optimistically update UI
    setConversations((prevConversations) =>
      prevConversations.map((conv) =>
        conv.id === id ? { ...conv, name: newTitle } : conv
      )
    );

    try {
      await apiClient.patch(
        `/conversations/${id}/`,
        { name: newTitle },
        { headers: { "Content-Type": "application/json" } } // Explicitly set Content-Type
      );
      toast({
        title: "Title updated",
        description: "Conversation title has been updated successfully",
      });
    } catch (err: any) {
      console.error("Error updating title:", err);
      // Revert UI on error
      setConversations(originalConversations);
      toast({
        title: "Error updating title",
        description:
          err.response?.data?.detail ||
          err.message ||
          "Failed to save title change.",
        variant: "destructive",
      });
    }
  };

  const handleViewDetails = (id: string | number) => {
    navigate(`/conversations/${String(id)}`);
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
    if (
      seconds === null ||
      seconds === undefined ||
      isNaN(seconds) ||
      seconds < 0
    )
      return "--:--";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Helper function to create transcription preview - Simplified
  const createTranscriptionPreview = (
    status: string | undefined
  ): string => {
    switch (status) {
        case 'processing':
        case 'pending':
          return "Processing...";
        case 'completed':
          // We know it's done, but don't have easy text access here
          return "Transcription available."; 
        case 'failed':
          return "Transcription failed.";
        default:
          return "No transcription data.";
      }
    // Removed old logic using text.trim() / text.substring()
  };

  // --- Filtering Logic --- Simplified
  const filteredConversations = conversations.filter((conv) => {
    // 1. Search Term Filter (Name only)
    const searchMatch =
      searchTerm === "" ||
      conv.name.toLowerCase().includes(searchTerm.toLowerCase());
      // Removed search within conv.transcription_text

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
        if (
          startDate &&
          endDate &&
          !isNaN(startDate.getTime()) &&
          !isNaN(endDate.getTime()) &&
          createdAt >= startDate &&
          createdAt <= endDate
        ) {
          dateMatch = true;
          break; // Found a match for one of the selected date filters
        }
      }
      if (!dateMatch) return false; // No selected date ranges matched
    }

    // If all filters pass
    return true;
  });

  // --- Render Logic ---

  return (
    // Use a flex column layout for the overall page structure
    <div className="flex flex-col min-h-screen">
      {/* Main content area */}
      <main className="container mx-auto px-4 py-8 flex-grow">
          {/* Search and Filter Bar */}
          <div className="mb-6">
            <SearchFilter
              onSearchChange={handleSearchChange}
              onFilter={handleFilterChange}
            />
          </div>

          {/* Conversation Grid or Message */}
          {isLoading ? (
            <div className="text-center py-10">Loading conversations...</div>
          ) : error ? (
            <div className="text-center py-10 text-red-600">
              <p>{error}</p>
              <Button
                onClick={() => window.location.reload()} // Simple retry
                variant="outline"
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          ) : filteredConversations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredConversations.map((conv) => (
                <ConversationCard
                  key={conv.id}
                  id={String(conv.id)}
                  title={conv.name}
                  date={formatDate(conv.created_at)}
                  duration={formatDuration(conv.duration)}
                  previewText={
                    conv.summary_data?.short ??
                    // Pass only status to the simplified preview function
                    createTranscriptionPreview(conv.status_transcription)
                  }
                  onClick={() => handleViewDetails(conv.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              No conversations found.
            </div>
          )}
      </main>
        
      {/* Modal and FAB are positioned fixed, so can be outside main */}
      <RecordingModal
        isOpen={isRecordingModalOpen}
        onClose={() => setIsRecordingModalOpen(false)}
        onSave={handleSaveRecording}
        isSaving={isSaving}
      />

      <FloatingActionButton onFabClick={() => setIsRecordingModalOpen(true)} />
    </div>
  );
};

export default Home;
