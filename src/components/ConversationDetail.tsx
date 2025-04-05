import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from "../lib/apiClient"; // Import apiClient
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card } from "./ui/card";
import TranscriptionView from "./TranscriptionView";
import AnalysisPanel from "./AnalysisPanel";
import { ArrowLeft, Share2, Download, Play, Pause } from "lucide-react";

// Interface should match the data structure returned by the /api/conversations/{id}/ endpoint
interface Conversation {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  status: string;
  audio_file: string | null; // URL to the audio file
  duration: number | null; // Duration in seconds from backend
  // Add Phase 3 fields
  status_transcription: string;
  status_transcription_display: string;
  transcription_text: string | null;
}

const ConversationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Effect to load data from API when component mounts or ID changes
  useEffect(() => {
    let isMounted = true; // Prevent state updates on unmounted component
    let intervalId: NodeJS.Timeout | null = null; // For polling

    const fetchConversationDetail = async () => {
      if (!isMounted) return; // Don't fetch if component unmounted
      // Keep loading state only for initial load?
      // setIsLoading(true);
      // setError(null); // Don't clear error on refetch?

      try {
        const response = await apiClient.get<Conversation>(`/conversations/${id}/`);
        if (isMounted) {
            setConversation(response.data);
            // Check if transcription is still processing
            if (response.data.status_transcription === 'processing' || response.data.status_transcription === 'pending') {
                // If processing, schedule a refetch (polling)
                if (!intervalId) { // Start polling only once
                    console.log("Transcription processing, starting poll...");
                    intervalId = setInterval(fetchConversationDetail, 5000); // Poll every 5 seconds
                }
            } else {
                // If completed or failed, stop polling
                if (intervalId) {
                    console.log("Transcription finished, stopping poll.");
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
            setIsLoading(false); // Set loading false after first fetch attempt
          }
      }
    };

    if (id) {
        fetchConversationDetail(); // Initial fetch
    } else {
        setError("Conversation ID is missing from URL.");
        setIsLoading(false);
    }

    // Cleanup function
    return () => {
      isMounted = false;
      if (intervalId) {
        console.log("Cleaning up polling interval.");
        clearInterval(intervalId);
      }
    };
  }, [id]); // Re-run effect if ID changes

  const formatDuration = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) return "--:--";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
    // TODO: Implement actual audio playback control using conversation.audio_file URL
    if (conversation?.audio_file) {
        console.log("Audio URL:", conversation.audio_file);
        // Add logic here to load and control an <audio> element
    } else {
        console.log("No audio file URL available.");
    }
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
  const { name: title, created_at, duration, audio_file, status_transcription, status_transcription_display, transcription_text } = conversation;
  const currentDuration = duration;

  // Format date using the helper function defined above
  const date = formatDate(created_at);

  return (
    <div className="flex flex-col h-full w-full bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2" aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <div className="flex items-center text-gray-500 text-sm mt-1">
              <span>{date}</span>
              <span className="mx-2">•</span>
              <span>{formatDuration(currentDuration)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download
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
            disabled={!audio_file} // Disable play if no audio file URL
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <div className="flex-grow">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-150"
                style={{ width: `${currentDuration && currentDuration > 0 ? (currentTime / currentDuration) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(currentDuration)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Content Tabs */}
      <Tabs defaultValue="transcript" className="flex-grow flex flex-col">
        <TabsList className="mb-4 flex-shrink-0">
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        <div className="flex-grow overflow-hidden">
          <TabsContent value="transcript" className="h-full">
            <TranscriptionView 
              transcription={transcription_text}
              status={status_transcription}
              statusDisplay={status_transcription_display}
            />
          </TabsContent>

          <TabsContent value="analysis" className="h-full">
            <AnalysisPanel />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default ConversationDetail;
