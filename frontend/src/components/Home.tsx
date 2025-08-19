import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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

interface UserProfileData { // Define UserProfileData if not already defined globally
  username: string;
  resume: string | null;
  job_description: string | null;
}

const Home = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, loading: authLoading } = useAuth(); // Renamed loading to authLoading for clarity
  
  // Determine active tab from URL path
  const getActiveTabFromPath = (pathname: string): string => {
    if (pathname === '/conversations') return 'conversations';
    if (pathname === '/interviews') return 'mock-interviews';
    return 'conversations'; // Default fallback
  };
  
  const [activeTab, setActiveTab] = useState<string>(getActiveTabFromPath(location.pathname));
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null); // Reference for polling interval

  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true); // Specific loading for conversations
  const [isSaving, setIsSaving] = useState(false); // For save operation
  const [conversationError, setConversationError] = useState<string | null>(null); // Specific error for conversations
  const [searchTerm, setSearchTerm] = useState<string>(""); // State for search term
  const [activeFilters, setActiveFilters] = useState<FilterOptions>({}); // State for active filters

  const [profileResumeUrl, setProfileResumeUrl] = useState<string | null>(null);
  const [profileJdUrl, setProfileJdUrl] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Update active tab when URL path changes
  useEffect(() => {
    const newActiveTab = getActiveTabFromPath(location.pathname);
    setActiveTab(newActiveTab);
  }, [location.pathname]);

  // Function to check if any conversation is still processing
  const checkForProcessingConversations = (conversations: Conversation[]): boolean => {
    return conversations.some(conv => 
      conv.status_transcription === 'processing' || 
      conv.status_transcription === 'pending' || 
      conv.status_recap === 'processing' || 
      conv.status_recap === 'pending' || 
      conv.status_summary === 'processing' || 
      conv.status_summary === 'pending'
    );
  };

  // Function to fetch and update a specific conversation
  const fetchAndUpdateConversation = async (conversationId: number) => {
    try {
      const response = await apiClient.get<Conversation>(`/conversations/${conversationId}/`);
      console.log(`Updated data for conversation ${conversationId}:`, response.data);
      
      // Update the specific conversation in state
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId ? response.data : conv
      ));

      return response.data;
    } catch (err) {
      console.error(`Error updating conversation ${conversationId}:`, err);
      return null;
    }
  };

  // Effect to fetch conversations from the API on component mount
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate("/login"); // Redirect to login if not authenticated
      return;
    }

    // Only fetch conversations if the conversations tab is active and user is authenticated
    if (isAuthenticated && activeTab === "conversations") {
      const fetchConversations = async () => {
        setIsLoadingConversations(true);
        setConversationError(null);
        try {
          const response = await apiClient.get<Conversation[]>("/conversations/");
          // Ensure response.data is an array. If API returns an object with a 'results' array:
          let fetchedConversations: Conversation[] = [];
          if (Array.isArray(response.data)) {
            fetchedConversations = response.data;
          } else if (response.data && Array.isArray((response.data as any).results)) {
            fetchedConversations = (response.data as any).results;
          } else {
            console.error("Unexpected response data format for conversations:", response.data);
            setConversationError("Failed to load conversations due to unexpected data format.");
          }
          
          setConversations(fetchedConversations);
          
          // Start polling if there are any processing conversations
          if (checkForProcessingConversations(fetchedConversations)) {
            startPollingForUpdates(fetchedConversations);
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
      
      // Clear any existing polling interval when leaving the conversations tab
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
    
    // Cleanup function
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, authLoading, navigate, activeTab]); // Add activeTab to dependency array
  
  // Start polling for updates to processing conversations
  const startPollingForUpdates = (conversations: Conversation[]) => {
    // Clear any existing interval first
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    console.log("Starting to poll for conversation updates...");
    
    pollingIntervalRef.current = setInterval(async () => {
      // Get IDs of conversations that are still processing
      const processingIds = conversations
        .filter(conv => 
          conv.status_transcription === 'processing' || 
          conv.status_transcription === 'pending' || 
          conv.status_recap === 'processing' || 
          conv.status_recap === 'pending' || 
          conv.status_summary === 'processing' || 
          conv.status_summary === 'pending'
        )
        .map(conv => conv.id);
      
      if (processingIds.length === 0) {
        // If no conversations are processing, stop polling
        console.log("No conversations are processing, stopping poll.");
        clearInterval(pollingIntervalRef.current!);
        pollingIntervalRef.current = null;
        return;
      }
      
      console.log(`Polling for updates on ${processingIds.length} conversations:`, processingIds);
      
      // Fetch updates for each processing conversation
      const updatedConvs = await Promise.all(
        processingIds.map(id => fetchAndUpdateConversation(id))
      );
      
      // Check if all processing is complete
      const stillProcessing = updatedConvs.some(conv => 
        conv && (
          conv.status_transcription === 'processing' || 
          conv.status_transcription === 'pending' || 
          conv.status_recap === 'processing' || 
          conv.status_recap === 'pending' || 
          conv.status_summary === 'processing' || 
          conv.status_summary === 'pending'
        )
      );
      
      if (!stillProcessing) {
        console.log("All conversations finished processing, stopping poll.");
        clearInterval(pollingIntervalRef.current!);
        pollingIntervalRef.current = null;
      }
    }, 5000); // Poll every 5 seconds, same as ConversationDetail
  };

  // Add a special effect to start polling when a new recording is saved
  useEffect(() => {
    if (conversations.length > 0) {
      // Check if any conversations are still processing
      if (checkForProcessingConversations(conversations)) {
        // Start polling for updates if not already polling
        if (!pollingIntervalRef.current) {
          startPollingForUpdates(conversations);
        }
      }
    }
  }, [conversations]); // This will run whenever conversations state changes

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
    const fileName = `${data.title || "recording"}-${Date.now()}.wav`;
    formData.append("audio_file", data.audio, fileName);

    try {
      console.log(`Starting upload for ${data.title || "Untitled Recording"} - Size: ${(data.audio.size / 1024 / 1024).toFixed(2)}MB`);
      
      // Send POST request to the backend with extended timeout for large files
      const response = await apiClient.post<Conversation>(
        "/conversations/",
        formData,
        {
          headers: {
            // Axios typically sets multipart/form-data automatically for FormData,
            // but specifying it can sometimes help avoid issues.
            "Content-Type": "multipart/form-data",
          },
          timeout: 600000, // 10 minutes for conversation uploads (longer than default)
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentComplete = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              console.log(`Upload progress: ${percentComplete}% (${(progressEvent.loaded / 1024 / 1024).toFixed(2)}MB / ${(progressEvent.total / 1024 / 1024).toFixed(2)}MB)`);
            }
          }
        }
      );
      console.log("New conversation created, API response data:", response.data); // Log the response

      // Add the newly created conversation (from response) to the beginning of the list
      setConversations((prevConversations) => [
        response.data,
        ...prevConversations,
      ]);
      
      // New conversation will likely be in processing state, start polling
      if (!pollingIntervalRef.current) {
        startPollingForUpdates([response.data, ...conversations]);
      }
      
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

  // Helper function to create transcription preview
  const createTranscriptionPreview = (conversation: Conversation): string => {
    // Check if conversation has required properties, handle missing properties gracefully
    if (!conversation) {
      return "Invalid conversation data";
    }
    
    const { id, status_transcription, transcription_text, summary_data, status_transcription_display } = conversation;

    // PRIORITY 1: Always check for short summary first, if it exists.
    if (summary_data?.short) {
      return summary_data.short || "Summary processing completed"; // Ensure non-empty return
    }

    // PRIORITY 2: Status-based logic if no short summary
    switch (status_transcription) {
      case 'processing':
      case 'pending':
        return `${status_transcription_display || status_transcription || "Processing"}...`; 
      case 'completed':
        // No summary_data.short, so try transcription_text
        if (Array.isArray(transcription_text) && transcription_text.length > 0) {
          try {
            let preview = transcription_text
              .slice(0, 2) // Take first 2 segments
              .map(segment => {
                if (!segment || typeof segment !== 'object') {
                  return ""; // Handle invalid segment
                }
                return (segment as { transcript: string }).transcript || "";
              }) // Type assertion
              .filter(text => text.trim() !== '') // Remove empty segments
              .join(' ');
            
            if (preview.trim() === '') {
              return "View details for full transcription";
            }
            
            return preview.substring(0, 100) + (preview.length > 100 ? '...' : '');
          } catch (e) {
            return "Transcription completed"; // Fallback for error case
          }
        } else if (typeof transcription_text === 'string' && transcription_text.trim() !== '') {
          return transcription_text.substring(0, 100) + (transcription_text.length > 100 ? '...' : '');
        }
        return "View details for transcription"; // Fallback for 'completed' if no summary and no usable transcription text
      case 'failed':
        return "Transcription failed";
      default:
        // This case means status_transcription is not one of the above, or is null/undefined,
        // AND summary_data.short was not available.
        // As a last resort, if there's any transcription_text, try to use it.
        if (Array.isArray(transcription_text) && transcription_text.length > 0) {
          try {
            let preview = transcription_text
              .slice(0, 1)
              .map(segment => {
                if (!segment || typeof segment !== 'object') {
                  return ""; // Handle invalid segment
                }
                return (segment as { transcript: string }).transcript || "";
              })
              .filter(text => text.trim() !== '')
              .join(' ');
            
            if (preview.trim() === '') {
              return "Processing transcription..."; // Fallback for empty preview
            }
            
            return preview.substring(0, 70) + (preview.length > 70 ? '... (status unknown)' : ' (status unknown)');
          } catch (e) { 
            return "Processing audio..."; // Fallback for error
          }
        } else if (typeof transcription_text === 'string' && transcription_text.trim() !== '') {
          return transcription_text.substring(0, 70) + (transcription_text.length > 70 ? '... (status unknown)' : ' (status unknown)');
        }
        
        // Handle case where status might be null/undefined
        if (!status_transcription) {
          return "Recording saved, processing...";
        }
        
        return "Processing transcription..."; // More friendly final fallback
    }
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

  const fetchProfileForMockInterview = async () => {
    if (!isAuthenticated) return; // Should be authenticated to have a profile
    setIsLoadingProfile(true);
    console.log("Fetching profile for mock interview setup...");
    try {
      const response = await apiClient.get<UserProfileData>("/profile/");
      setProfileResumeUrl(response.data.resume);
      setProfileJdUrl(response.data.job_description);
      console.log("Profile for mock interview fetched:", response.data);
      return response.data; // Return data for immediate use
    } catch (err) {
      console.error("Error fetching profile for mock interview:", err);
      // Don't block modal opening, just won't pre-fill
      toast({
        title: "Could not load saved documents",
        description: "Unable to fetch your saved resume/JD. You can still upload new ones.",
        variant: "default", // Or "warning" if you have one
      });
      setProfileResumeUrl(null);
      setProfileJdUrl(null);
      return null;
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleOpenMockInterviewSetup = async () => {
    await fetchProfileForMockInterview();
    // This state is for the modal in CareerConversationsView, we need one for MockInterviewsView
    // setIsRecordingModalOpen(true); // This is WRONG, this is for the recording modal.
    // We need to trigger the modal in MockInterviewsView.
    // This suggests that the modal state and opening logic should be in Home.tsx
    // or MockInterviewsView needs to handle its own modal opening after profile fetch.

    // For now, let's assume MockInterviewsView will handle its own modal state
    // and Home.tsx will just pass the profile data.
    // The actual opening of the modal will be triggered by a click in MockInterviewsView.
    // So, this function might not be directly used to *open* the modal from Home,
    // but rather, the profile data needs to be available to MockInterviewsView.

    // Let's refine: MockInterviewsView needs these URLs when its FAB is clicked.
    // The fetch should happen *before* MockInterviewsView tries to open its modal.
  };

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
          <MockInterviewsView
            profileResumeUrl={profileResumeUrl}
            profileJdUrl={profileJdUrl}
            fetchProfileForMockInterview={fetchProfileForMockInterview}
            isLoadingProfile={isLoadingProfile}
          />
        )}
      </main>
    </div>
  );
};

export default Home;
