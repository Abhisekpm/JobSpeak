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
import { ArrowLeft, Share2, Download, Play, Pause, MoreHorizontal } from "lucide-react";
import { toast } from "./ui/use-toast"; // Import toast
import { Loader2, AlertTriangle, Info } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

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

  // State for active tab
  const [activeTab, setActiveTab] = useState<string>("transcript"); 

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
        return; // Exit if ref is not ready
    }

    // --- Set or Remove Audio Source --- 
    let audioSrc: string | null = null;
    if (conversation?.audio_file) {
        // Use the URL directly from the backend response
        audioSrc = conversation.audio_file;
    }

    if (audioSrc) {
        if (audio.src !== audioSrc) {
            console.log(`Setting audio source to: ${audioSrc}`);
            setIsAudioReady(false);
            audio.src = audioSrc;
            audio.load();
            console.log("Called audio.load()");
        }
    } else {
        // Remove source if no URL and src currently exists
        if (audio.src) {
            console.log("Removing audio source.");
            audio.removeAttribute('src');
            audio.load(); // Important to reflect change
            setIsAudioReady(false); // Reset readiness
             // Reset playback state
            setIsPlaying(false);
            setCurrentTime(0);
            setAudioDuration(0);
        }
    }
    
    // --- Add Event Listeners --- 
    const handleTimeUpdate = () => { setCurrentTime(audio.currentTime); };
    const handleLoadedMetadata = () => { 
        console.log("Audio metadata loaded. Browser duration:", audio.duration);
    };
    const handleEnded = () => { setIsPlaying(false); setCurrentTime(0); };
    const handleCanPlayThrough = () => { console.log("Audio can play through."); setIsAudioReady(true); };
    // Add error handling listener
    const handleError = (e: Event) => { 
      console.error("Audio Error:", e, audio.error);
      setError("An error occurred trying to load or play the audio."); // Set user-facing error
      setIsAudioReady(false); // Set to not ready on error
    }

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('error', handleError); // Add error listener

    // Cleanup listeners
    return () => {
      console.log("Cleaning up audio listeners.");
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('error', handleError); // Remove error listener
    };
    // Depend on conversation.audio_file to re-run when URL changes
  }, [conversation?.audio_file]); 

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
    if (!audio || !audio.src) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // Check our readiness state first
      if (isAudioReady) {
           audio.play()
             .then(() => { setIsPlaying(true); })
             .catch(error => { console.error("Error playing audio:", error); setIsPlaying(false); });
      } else {
          console.warn("Audio not ready according to 'canplaythrough' event yet.");
      }
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
    
    try {
      // Show loading toast
      toast({
        title: "Preparing download...",
        description: "We're generating a secure download link for you.",
      });
      
      // Request a download URL from the backend
      const response = await apiClient.get(`/conversations/${conversation.id}/download_audio/`);
      
      if (response.data && response.data.download_url) {
        // Create a temporary link element
        const downloadLink = document.createElement('a');
        downloadLink.href = response.data.download_url;
        downloadLink.target = '_blank';
        downloadLink.download = `${conversation.name || 'audio'}.mp3`;
        
        // Trigger the download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Show success toast
        toast({
          title: "Download started",
          description: "Your audio file download has started.",
        });
      } else {
        throw new Error("No download URL returned");
      }
    } catch (err: any) {
      console.error("Error downloading audio:", err);
      toast({
        title: "Download failed",
        description: err.response?.data?.error || "Could not download the audio file.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
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
      try {
          // Check if it's already an object/array (e.g., if Axios parsed it deeply)
          if (typeof conversation.transcription_text === 'object' && Array.isArray(conversation.transcription_text)) {
              parsedTranscription = conversation.transcription_text;
          } else if (typeof conversation.transcription_text === 'string') {
               // Attempt to parse if it's a string (most likely case)
              const parsed = JSON.parse(conversation.transcription_text);
              if (Array.isArray(parsed)) { // Basic validation
                  parsedTranscription = parsed;
              } else {
                   console.error("Parsed transcription_text is not an array:", parsed);
              }
          }
      } catch (error) {
          console.error("Failed to parse transcription_text JSON:", error, "Raw data:", conversation.transcription_text);
      }
  }
  // --- End Parsing --- 

  return (
    <div className="flex flex-col h-full w-full bg-gray-50 p-4 md:p-6">
      {/* Change preload to "auto" */}
      <audio ref={audioRef} preload="auto" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2" aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
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
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          {/* --- Share Button Removed --- */}
          {/* <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button> */}
          {/* --- END OF SHARE BUTTON --- */}

          {/* --- Download Button (remains) --- */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAudioDownload}
            disabled={isDownloading || !conversation.audio_file}
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Audio Player */}
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
      {/* Set default tab to 'transcript' */}
      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab} 
        className="flex-1 flex flex-col overflow-hidden min-h-0"
      >
        {/* Use justify-between to push dropdown to the right */}
        <TabsList className="flex justify-between items-center gap-2 mb-6 shrink-0">
          {/* Visible Tabs */}
          <div className="flex items-center gap-2">
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="recap">Recap</TabsTrigger>
            {/* Make Summary always visible */}
            <TabsTrigger value="summary">Summary</TabsTrigger> 
            {/* Hidden on small screens, visible on medium and up */}
            <TabsTrigger value="coaching" className="hidden md:inline-flex">Coaching</TabsTrigger>
            <TabsTrigger value="analysis" className="hidden md:inline-flex">Analysis</TabsTrigger>
          </div>

          {/* Dropdown Menu - Visible only on small screens */}
          <div className="md:hidden"> {/* Hide on medium screens and up */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More tabs</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Remove Summary from dropdown */}
                {/* <DropdownMenuItem 
                  onSelect={() => setActiveTab('summary')} 
                  disabled={activeTab === 'summary'}
                >
                  Summary
                </DropdownMenuItem> */}
                <DropdownMenuItem 
                  onSelect={() => setActiveTab('coaching')} 
                  disabled={activeTab === 'coaching'}
                >
                  Coaching
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onSelect={() => setActiveTab('analysis')} 
                  disabled={activeTab === 'analysis'}
                >
                  Analysis
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TabsList>

        {/* Content sections remain - order in code doesn't affect display */}
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
        
        {/* Update TabsContent value */}
        <TabsContent value="transcript" className="flex-1 overflow-auto">
          <TranscriptionView
            transcription={parsedTranscription}
            status={conversation.status_transcription}
            statusDisplay={conversation.status_transcription_display}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConversationDetail;
