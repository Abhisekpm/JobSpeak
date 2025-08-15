import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from "../lib/apiClient"; // Import apiClient
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card } from "./ui/card";
import TranscriptionView from "./TranscriptionView";
import AnalysisPanel from "./AnalysisPanel";
import RecapView from "./RecapView"; // Import the new RecapView component
import SummaryView from "./SummaryView"; // Import the new SummaryView component
import CoachingView from "./CoachingView"; // Import the new CoachingView component
import { ArrowLeft, Download, Play, Pause, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "./ui/use-toast"; // Import toast
import { Loader2, AlertTriangle, Info } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "./ui/dropdown-menu";
import useMediaQuery from "../hooks/useMediaQuery"; // Import the new hook

// Interface should match the data structure returned by the /api/conversations/{id}/ endpoint
interface TranscriptionSegment {
  speaker: number | string;
  transcript: string;
  // Add other potential fields
}

interface Conversation {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  // status: string; // Remove if unused
  audio_file: string | null; // URL to the audio file
  duration: number | null; // Duration in seconds from backend
  // Transcription fields
  status_transcription: string;
  status_transcription_display: string;
  transcription_text: TranscriptionSegment[] | null;
  // Recap fields
  status_recap: string;
  status_recap_display: string;
  recap_text: string | null;
  // Summary fields
  status_summary: string;
  status_summary_display: string;
  // Change summary_text to an object holding different lengths
  summary_data: { 
    short: string | null;
    balanced: string | null;
    detailed: string | null;
  } | null;
  // Analysis fields (if/when added)
  status_analysis: string;
  status_analysis_display: string;
  analysis_results: {
    talk_time_ratio: { [speaker: string]: number } | null;
    sentiment: { label: string; reasoning: string } | null;
    topics: string[] | null;
  } | null;
  // Coaching fields (Add if needed by other components)
  status_coaching: string;
  status_coaching_display: string;
  coaching_feedback: string | null;
}

const ConversationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // State for active tab - Set default to 'recap'
  const [activeTab, setActiveTab] = useState<string>("recap"); 
  const isMobileView = useMediaQuery('(max-width: 768px)'); // Use md breakpoint

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // State for inline title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState<string>("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // --- Initialize editedTitle when conversation loads ---
  useEffect(() => {
      if (conversation && !isEditingTitle) { // Also check if not currently editing
          setEditedTitle(conversation.name);
      }
  }, [conversation?.name, isEditingTitle]); // Depend on name and editing state

  // --- Fetch Data ---
  useEffect(() => {
    let isMounted = true; 
    let intervalId: NodeJS.Timeout | null = null; 
    
    // Reset state
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioDuration(0);

    const fetchConversationDetail = async () => {
      if (!isMounted) return;

      try {
        const response = await apiClient.get<Conversation>(`/conversations/${id}/`);
        if (isMounted) {
            const fetchedConversation = response.data;
            setConversation(fetchedConversation);
            console.log("Fetched Conversation Data:", fetchedConversation);

            // Re-initialize audioDuration state
            if (fetchedConversation.duration !== null && Number.isFinite(fetchedConversation.duration)) {
              setAudioDuration(fetchedConversation.duration);
            } else {
              setAudioDuration(0);
            }
            
            // Check if ANY process is still pending or processing
            const isProcessing = [
                fetchedConversation.status_transcription,
                fetchedConversation.status_recap,
                fetchedConversation.status_summary,
                fetchedConversation.status_analysis, // Add analysis status check
                fetchedConversation.status_coaching  // Add coaching status check
            ].some(status => status === 'processing' || status === 'pending');

            if (isProcessing) {
                // If processing, schedule a refetch
                if (!intervalId) { // Start polling only once
                    console.log("Polling started as some processes are pending/processing...");
                    intervalId = setInterval(fetchConversationDetail, 5000); // Poll every 5 seconds
                }
            } else {
                // If all completed or failed, stop polling
                if (intervalId) {
                    console.log("All processes finished, stopping poll.");
                    clearInterval(intervalId);
                    intervalId = null;
                }
            }
            setError(null); // Clear error on successful fetch
        }
      } catch (err: any) {
        console.error("Error fetching conversation detail:", err);
        if (isMounted) {
            if (err.response?.status === 404) {
                setError(`Conversation with ID "${id}" not found.`);
            } else {
                setError("Failed to load conversation details due to an error.");
            }
             // Stop polling on error
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        }
      } finally {
          if (isMounted) {
            setIsLoading(false); 
          }
      }
    };

    if (id) {
        fetchConversationDetail(); 
    } else {
        setError("Conversation ID is missing from URL.");
        setIsLoading(false);
    }

    return () => {
      isMounted = false;
      if (intervalId) {
        console.log("Cleaning up polling interval.");
        clearInterval(intervalId);
      }
    };
  }, [id]);

  // --- Audio Event Listeners & Source Setting ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      console.log("Audio ref not available yet.");
      return;
    }

    let currentAudioSrc = audio.src;
    let newAudioSrc: string | null = null;

    if (conversation?.audio_file) {
      newAudioSrc = conversation.audio_file;
    }

    // --- Event Handlers ---
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    
    const handleLoadedMetadata = () => {
      console.log("Audio metadata loaded. Browser duration:", audio.duration);
      const backendDuration = conversation?.duration;
      if (backendDuration !== null && typeof backendDuration !== 'undefined' && Number.isFinite(backendDuration) && backendDuration > 0) {
          setAudioDuration(backendDuration);
      } else if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setAudioDuration(audio.duration);
      } else {
          setAudioDuration(0); // Fallback
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0); // Reset to start
    };

    const handleCanPlayThrough = () => {
      console.log("Audio can play through.");
      setIsAudioReady(true);
    };

    const handleError = (e: Event) => {
      console.error("Audio Error:", e, audio.error);
      let errorMessage = "An error occurred trying to load or play the audio.";
      if (audio.error) {
          switch (audio.error.code) {
              case MediaError.MEDIA_ERR_ABORTED:
                  errorMessage = "Audio playback aborted.";
                  break;
              case MediaError.MEDIA_ERR_NETWORK:
                  errorMessage = "A network error caused audio download to fail.";
                  break;
              case MediaError.MEDIA_ERR_DECODE:
                  errorMessage = "Audio playback failed due to a decoding error.";
                  break;
              case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                  errorMessage = "Audio source not supported or audio format is invalid.";
                  break;
              default:
                  errorMessage = "An unknown audio error occurred.";
          }
      }
      setError(errorMessage);
      setIsAudioReady(false);
      setIsPlaying(false);
    };

    // --- Source Management ---
    if (newAudioSrc && currentAudioSrc !== newAudioSrc) {
      console.log(`Setting new audio source to: ${newAudioSrc}`);
      audio.src = newAudioSrc;
      setIsAudioReady(false);
      setIsPlaying(false);
      setCurrentTime(0);
      audio.load();
    } else if (!newAudioSrc && currentAudioSrc) {
      console.log("Removing audio source.");
      audio.removeAttribute('src');
      audio.load();
      setIsAudioReady(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setAudioDuration(0);
    }

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('error', handleError);

    return () => {
      console.log("Cleaning up audio listeners for source:", currentAudioSrc);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('error', handleError);
    };
  }, [conversation?.audio_file, conversation?.duration]);

  // --- Inline Title Editing Logic ---

  // Effect to focus input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
        titleInputRef.current.focus();
        titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleClick = (e: React.MouseEvent) => {
      if (conversation) {
          e.stopPropagation();
          setIsEditingTitle(true);
      }
  };

  const handleTitleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditedTitle(e.target.value);
  };

  const saveTitle = async () => {
      // Trim whitespace before comparing and saving
      const newTitleTrimmed = editedTitle.trim();

      // Exit if no conversation loaded yet
      if (!conversation) {
          setIsEditingTitle(false);
          return;
      }

      // Exit if title is empty or hasn't changed
      if (newTitleTrimmed === "" || newTitleTrimmed === conversation.name) {
          setIsEditingTitle(false);
          setEditedTitle(conversation.name); // Reset input value to original valid name
          // Optional: Show toast if title was empty
          if (newTitleTrimmed === "" && editedTitle !== "") {
             toast({
                title: "Invalid Title",
                description: "Title cannot be empty.",
                variant: "destructive",
             });
          }
          return;
      }

      const originalTitle = conversation.name;

      // Optimistic UI Update
      setConversation(prev => prev ? { ...prev, name: newTitleTrimmed } : null);
      setIsEditingTitle(false);

      try {
          await apiClient.patch(`/conversations/${id}/`, { name: newTitleTrimmed }, {
              headers: { 'Content-Type': 'application/json' }
          });
          toast({
             title: "Title Updated",
             description: "Conversation title saved successfully.",
          });
      } catch (err: any) {
          console.error("Error updating title:", err);
          // Revert UI on error
          setConversation(prev => prev ? { ...prev, name: originalTitle } : null);
          setEditedTitle(originalTitle); // Reset editedTitle state as well for consistency
          toast({
            title: "Error updating title",
            description: err.response?.data?.detail || err.message || "Failed to save title change.",
            variant: "destructive"
          });
      }
  };

    const handleTitleInputBlur = () => {
        // Save on blur
        saveTitle();
    };

    const handleTitleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            saveTitle();
            e.preventDefault(); // Prevent potential form submission
        } else if (e.key === 'Escape') {
            if (conversation) setEditedTitle(conversation.name); // Reset to original
            setIsEditingTitle(false);
        }
    };

  const formatDuration = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
        return "--:--";
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio || !audio.src || !isAudioReady) {
      console.warn("Audio not ready or no source. Cannot toggle playback.", { hasSrc: !!audio?.src, isAudioReady });
      if (!audio?.src && conversation?.audio_file && audio) { // Check audio exists before setting src
          audio.src = conversation.audio_file;
          audio.load();
      }
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(error => {
          console.error("Error attempting to play audio:", error);
          setIsPlaying(false);
          setError("Could not start audio playback.");
        });
    }
  };

  // --- Seek Functionality (Click on Progress Bar) ---
  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      const progressBar = progressBarRef.current;
      if (!audio || !progressBar || !isAudioReady || audioDuration <= 0) return;

      // Calculate the click position percentage relative to the progress bar
      const rect = progressBar.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width)); // Clamp between 0 and 1

      // Calculate the new time and set it
      const newTime = percentage * audioDuration;
      audio.currentTime = newTime;
      setCurrentTime(newTime); // Update state immediately for responsiveness
  };

  const handleBack = () => {
    navigate(-1);
  };

  // Helper function to format date (can be moved to utils if needed)
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return "Invalid Date";
    }
  };

  // Function to handle audio download
  const handleAudioDownload = async () => {
    if (!conversation?.id) return;
    setIsDownloading(true);
    toast({ title: "Preparing download..." }); // Simplified initial toast
    try {
      const response = await apiClient.get(`/conversations/${conversation.id}/download_audio/`);
      if (response.data && response.data.download_url) {
        const downloadLink = document.createElement('a');
        downloadLink.href = response.data.download_url;
        downloadLink.target = '_blank'; // Optional: open in new tab if browser blocks direct download
        downloadLink.download = `${conversation.name || 'audio'}.mp3`; // Default filename
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        toast({ title: "Download started" });
      } else {
        throw new Error("No download URL returned from server.");
      }
    } catch (err: any) {
      console.error("Error downloading audio:", err);
      toast({
        title: "Download failed",
        description: err.response?.data?.error || err.message || "Could not download the audio file.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversation) return;
    if (!window.confirm("Are you sure you want to delete this conversation? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      await apiClient.delete(`/conversations/${conversation.id}/`);
      toast({
        title: "Conversation Deleted",
        description: `Conversation "${conversation.name}" has been successfully deleted.`,
        variant: "default",
      });
      navigate("/home");
    } catch (err: any) {
      console.error("Error deleting conversation:", err);
      toast({
        title: "Error Deleting Conversation",
        description:
          err.response?.data?.detail ||
          err.message ||
          "Failed to delete conversation. Please try again.",
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center">Loading conversation details...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
        <p>Error: {error}</p>
        <Button onClick={handleBack} variant="outline" className="mt-4">Go Back</Button>
      </div>
    );
  }

  if (!conversation) {
    return <div className="p-6 text-center">Conversation data is unavailable.</div>;
  }

  // Destructure data from the loaded conversation state
  // Use 'name' field for title
  const { name: title, created_at, audio_file } = conversation;
  const currentDuration = audioDuration;

  // Format date using the helper function defined above
  const date = formatDate(created_at);

  // Calculate progress percentage safely
  const progressPercent = (Number.isFinite(currentDuration) && currentDuration > 0) 
                          ? (currentTime / currentDuration) * 100 
                          : 0;

  // --- Parse transcription_text before rendering --- 
  let parsedTranscription: TranscriptionSegment[] | null = null;
  if (conversation.transcription_text) {
      // With the backend fix, transcription_text should now be properly deserialized
      if (Array.isArray(conversation.transcription_text)) {
          parsedTranscription = conversation.transcription_text;
      } else if (typeof conversation.transcription_text === 'string') {
          // Fallback for existing data that might still be double-encoded
          try {
              let parsed = JSON.parse(conversation.transcription_text);
              // Handle potential double-encoding from legacy data
              if (typeof parsed === 'string') {
                  parsed = JSON.parse(parsed);
              }
              if (Array.isArray(parsed)) {
                  parsedTranscription = parsed;
              } else {
                  console.error("Legacy transcription parsing failed - not an array:", parsed);
              }
          } catch (error) {
              console.error("Failed to parse legacy transcription string:", error);
          }
      } else {
          console.error("Unexpected transcription_text format:", typeof conversation.transcription_text);
      }
  }
  // --- End Parsing --- 

  return (
    <div className="flex flex-col h-screen bg-gray-50 p-0 md:p-6 overflow-hidden">
      {/* Header Section */}
      <header className="flex items-center justify-between mb-2 md:mb-6 bg-white md:bg-transparent p-4 md:p-0 border-b md:border-b-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-2 flex-shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center space-x-2 flex-grow min-w-0 mx-2">
          {isEditingTitle ? (
              <input
                  ref={titleInputRef}
                  type="text"
                  value={editedTitle}
                  onChange={handleTitleInputChange}
                  onBlur={handleTitleInputBlur}
                  onKeyDown={handleTitleInputKeyDown}
                  onClick={(e) => e.stopPropagation()} // Prevent triggering other clicks
                  className="text-xl font-semibold bg-transparent border-b border-primary focus:outline-none w-full px-1 py-0.5 -my-0.5" // Adjusted styles
                  aria-label="Edit conversation title"
                  autoComplete="off"
              />
          ) : (
              <h1
                  onClick={handleTitleClick}
                  className="text-2xl font-bold truncate cursor-pointer hover:text-primary px-1 py-0.5 -my-0.5" // Adjusted styles & added padding like input
                  title={conversation.name} // Show full title on hover
              >
                  {conversation.name}
              </h1>
          )}
          <div className="flex items-center text-gray-500 text-sm mt-1">
            <span>{date}</span>
            <span className="mx-2">•</span>
            <span>{formatDuration(currentDuration)}</span>
          </div>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Download Menu Item ADDED */}
              <DropdownMenuItem onClick={handleAudioDownload} disabled={isDownloading || !conversation?.audio_file}>
                {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                <span>Download Audio</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDeleteConversation} disabled={isDeleting} className="text-red-600 hover:!text-red-600 hover:!bg-red-50 focus:!text-red-600 focus:!bg-red-50">
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                <span>Delete Conversation</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Audio Player */}
      <audio ref={audioRef} preload="metadata" style={{ display: 'none' }} />
      <Card className="p-4 mb-6 bg-white shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={togglePlayback}
            aria-label={isPlaying ? "Pause playback" : "Start playback"}
            disabled={!audio_file || !isAudioReady}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <div className="flex-grow">
            <div 
              ref={progressBarRef} 
              onClick={handleSeek}
              className="h-2 bg-gray-200 rounded-full overflow-hidden cursor-pointer group"
            >
              <div
                className="h-full bg-primary transition-all duration-100 pointer-events-none"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(currentDuration)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs for Views */}
      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab} 
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="flex justify-between items-center gap-2 mb-6 shrink-0">
          {/* Main Visible Tabs */}
          <div className="flex items-center gap-2">
            <TabsTrigger value="recap">Recap</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="coaching">Coaching</TabsTrigger>
            {!isMobileView && (
              <>
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
              </>
            )}
          </div>

          {/* "More" Dropdown Menu - Only for mobile or if needed */} 
          {isMobileView && (
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">More tabs</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* These items are now conditionally in tabs on wider screens */}
                  {/* Consider if these should always be in dropdown or only when not a tab */}
                  <DropdownMenuItem 
                    onSelect={() => setActiveTab('analysis')} 
                    disabled={activeTab === 'analysis'}
                  >
                    Analysis
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={() => setActiveTab('transcript')} 
                    disabled={activeTab === 'transcript'}
                  >
                    Transcript
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </TabsList>

        {/* Content sections - Order in code doesn't affect display, value prop controls it */}
        <TabsContent value="analysis" className="flex-1 overflow-auto">
            <AnalysisPanel conversation={conversation} />
        </TabsContent>

        <TabsContent value="coaching" className="flex-1 overflow-auto">
             <CoachingView conversation={conversation} />
        </TabsContent>

        <TabsContent value="recap" className="flex-1 overflow-auto">
          <RecapView conversation={conversation} />
        </TabsContent>

        <TabsContent value="summary" className="flex-1 overflow-auto">
            <SummaryView conversation={conversation} />
        </TabsContent>
        
        <TabsContent value="transcript" className="flex-1 overflow-auto">
          <TranscriptionView
            transcription={parsedTranscription}
            status={conversation?.status_transcription || "pending"}
            statusDisplay={conversation?.status_transcription_display || "Pending"}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConversationDetail;
