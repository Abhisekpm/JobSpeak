import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card } from "./ui/card";
import TranscriptionView from "./TranscriptionView";
import AnalysisPanel from "./AnalysisPanel";
import { ArrowLeft, Share2, Download, Play, Pause } from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  date: string;
  duration: number;
  // audioUrl?: string; // If you plan to store audio URLs
}

const ConversationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    if (!id) {
      setError("Conversation ID is missing.");
      setIsLoading(false);
      return;
    }

    try {
      const savedConversationsJSON = localStorage.getItem('conversations');
      if (savedConversationsJSON) {
        const allConversations: Conversation[] = JSON.parse(savedConversationsJSON);
        const foundConversation = allConversations.find(conv => conv.id === id);
        if (foundConversation) {
          setConversation(foundConversation);
        } else {
          setError(`Conversation with ID "${id}" not found.`);
        }
      } else {
        setError("No saved conversations found in local storage.");
      }
    } catch (err) {
      console.error("Error loading conversation:", err);
      setError("Failed to load conversation details due to an error.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const formatDuration = (seconds: number | undefined): string => {
    if (seconds === undefined || isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
    // TODO: Implement actual audio playback control
  };

  const handleBack = () => {
    navigate(-1);
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
    // Should be caught by error state, but as a fallback
    return <div className="p-6 text-center">Conversation data is unavailable.</div>;
  }

  const { title, date, duration } = conversation;
  const currentDuration = duration || 0;

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
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <div className="flex-grow">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-150"
                style={{ width: `${currentDuration > 0 ? (currentTime / currentDuration) * 100 : 0}%` }}
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
            <TranscriptionView />
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
