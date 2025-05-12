import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../lib/apiClient"; // Import the API client
import FloatingActionButton from "./FloatingActionButton";
import ConversationCard from "./ConversationCard";
import RecordingModal from "./RecordingModal";
import SearchFilter from "./SearchFilter"; // Import the SearchFilter component
import { Button } from "./ui/button"; // Added for error display
import { toast } from "./ui/use-toast"; // Assuming use-toast is setup (from shadcn/ui)
import { useAuth } from "../contexts/AuthContext"; // <-- Corrected path
import TabNavigationBar from "./ui/TabNavigationBar"; // Import the new TabNavigationBar
import CareerConversationsView from "./CareerConversationsView"; // Import the new view
import MockInterviewsView from "./MockInterviewsView"; // Import the new component

// Define a type for the conversation object matching the backend model/serializer
export interface Conversation {
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
export interface FilterOptions {
  date?: string[]; // Array like ["Today", "This Month"]
  // duration removed
}

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, loading: authLoading } = useAuth(); // Renamed loading to authLoading for clarity
  const [activeTab, setActiveTab] = useState<string>("conversations"); // Default to conversations tab

  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true); // Specific loading for conversations
  const [isSaving, setIsSaving] = useState(false); // For save operation
  const [conversationError, setConversationError] = useState<string | null>(null); // Specific error for conversations
  const [searchTerm, setSearchTerm] = useState<string>(""); // State for search term
  const [activeFilters, setActiveFilters] = useState<FilterOptions>({}); // State for active filters

  // Effect to fetch conversations from the API on component mount
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate("/login"); // Redirect to login if not authenticated
      return;
    }

    // Only fetch conversations if the conversations tab is active and user is authenticated
    // We might move this fetch into a separate component for CareerConversationsView later
    if (isAuthenticated && activeTab === "conversations") {
      const fetchConversations = async () => {
        setIsLoadingConversations(true);
        setConversationError(null);
        try {
          const response = await apiClient.get<Conversation[]>("/conversations/");
          // Ensure response.data is an array. If API returns an object with a 'results' array:
          // setConversations(Array.isArray(response.data) ? response.data : response.data.results || []);
          if (Array.isArray(response.data)) {
            setConversations(response.data);
          } else if (response.data && Array.isArray((response.data as any).results)) {
            setConversations((response.data as any).results);
          } else {
            console.error("Unexpected response data format for conversations:", response.data);
            setConversations([]); // Set to empty array on unexpected format
            setConversationError("Failed to load conversations due to unexpected data format.");
          }
        } catch (err: any) {
          console.error("Error fetching conversations:", err);
          setConversationError("Failed to load conversations. Please try again later.");
          setConversations([]); // Also set to empty on error
        } finally {
          setIsLoadingConversations(false);
        }
      };
      fetchConversations();
    } else if (activeTab !== "conversations") {
      // If not on conversations tab, clear conversations and loading state
      setConversations([]);
      setIsLoadingConversations(false);
      setConversationError(null);
    }
  }, [isAuthenticated, authLoading, navigate, activeTab]); // Add activeTab to dependency array

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
      toast({ title: "Conversation saved successfully!" });
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
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      let dateMatch = false;
      for (const filter of activeFilters.date) {
        if (filter === "Today" && createdAt.toDateString() === today.toDateString()) {
          dateMatch = true;
          break;
        }
        if (
          filter === "This Month" &&
          createdAt.getMonth() === currentMonth &&
          createdAt.getFullYear() === currentYear
        ) {
          dateMatch = true;
          break;
        }
        // Add more date filters here (e.g., "Last 7 days", "This Year")
      }
      if (!dateMatch) return false;
    }
    return true;
  });

  // --- Rendering Logic ---

  // Show loading indicator if auth is loading or conversations are loading
  if (authLoading || (isLoadingConversations && activeTab === "conversations")) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading...</p> {/* Replace with a proper spinner/loader component */}
      </div>
    );
  }

  // Display error message if an error occurred
  if (conversationError && activeTab === "conversations") {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-red-500">{conversationError}</p>
        <Button onClick={() => { 
          // Trigger refetch for conversations tab
          if (activeTab === "conversations") {
            // A bit of a hack to re-trigger useEffect, ideally fetchConversations would be callable
            setConversations([]); // Temporarily clear to force loading state
            setActiveTab(""); // Force tab change to re-trigger effect
            setTimeout(() => setActiveTab("conversations"), 0);
          } else {
            navigate(0);
          }
        }} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }
  
  const renderMockInterviewsContent = () => (
    <div className="container mx-auto p-4 text-center">
      <h2 className="text-2xl font-semibold mb-4">Mock Interviews</h2>
      <p className="text-gray-600">
        Practice your interview skills by uploading your resume and a job description.
        JobSpeak will generate tailored questions to help you prepare.
      </p>
      <p className="mt-4 text-gray-500">(Mock interview functionality coming soon!)</p>
      {/* FAB for "Practice" will be added here in a later step */}
    </div>
  );


  return (
    <div className="flex flex-col min-h-screen">
      {/* Assuming MainHeader is rendered by a parent layout component */}
      {/* <MainHeader /> */}
      <TabNavigationBar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-grow container mx-auto pt-4 px-4 pb-4 mt-4"> {/* Changed pt-8 to pt-4 */}
        {/* Conditionally render content based on active tab */}
        {activeTab === "conversations" && (
          <CareerConversationsView
            conversations={filteredConversations}
            isLoading={isLoadingConversations}
            isRecordingModalOpen={isRecordingModalOpen}
            setIsRecordingModalOpen={setIsRecordingModalOpen}
            isSaving={isSaving}
            handleSearchChange={handleSearchChange}
            handleFilterChange={handleFilterChange}
            handleViewDetails={handleViewDetails}
            handleSaveRecording={handleSaveRecording}
            formatDate={formatDate}
            formatDuration={formatDuration}
            createTranscriptionPreview={createTranscriptionPreview}
          />
        )}
        {activeTab === "mock-interviews" && (
          <MockInterviewsView /> // Render the placeholder view
        )}
      </main>
    </div>
  );
};

export default Home;
