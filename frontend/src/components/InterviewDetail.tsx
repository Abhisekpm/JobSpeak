import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from "../lib/apiClient";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card } from "./ui/card";
// import TranscriptionView from "./TranscriptionView"; // Will replace with InterviewTranscriptView
import AnalysisPanel from "./AnalysisPanel";
// import RecapView from "./RecapView"; // Not needed for interviews
// import SummaryView from "./SummaryView"; // Not needed for interviews
import CoachingView from "./CoachingView";
import InterviewTranscriptView from "./InterviewTranscriptView"; // New component
import { ArrowLeft, MoreHorizontal, Trash2 } from "lucide-react"; // Removed Download, Play, Pause
import { toast } from "./ui/use-toast";
import { Loader2 } from "lucide-react"; // Removed AlertTriangle, Info for now
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "./ui/dropdown-menu";

// Interface for Interview data
interface ParsedAnalysisResults {
  talk_time_ratio: { [speaker: string]: number } | null;
  sentiment: { label: string; reasoning: string } | null;
  topics: string[] | null;
  // Add other potential fields if AnalysisPanel uses them
}

interface Interview {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;

  status_transcription: string;
  status_transcription_display: string;
  transcription_text: string | null; // Interleaved Q&A

  status_analysis: string;
  status_analysis_display: string;
  analysis_results: ParsedAnalysisResults | null; // Parsed from JSON string

  status_coaching: string;
  status_coaching_display: string;
  coaching_feedback: string | null; // Can be simple text or pretty-printed JSON
}

const InterviewDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [activeTab, setActiveTab] = useState<string>("transcript"); // Default to transcript

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState<string>("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (interview && !isEditingTitle) {
      setEditedTitle(interview.name);
    }
  }, [interview?.name, isEditingTitle]);

  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;

    const fetchInterviewDetail = async () => {
      if (!isMounted) return;

      try {
        // Fetch raw interview data which might have JSON strings for some fields
        const response = await apiClient.get<any>(`/interviews/${id}/`); // Use any for raw fetch
        if (isMounted) {
          const rawData = response.data;
          
          // Parse fields before setting state
          let parsedAnalysisResults: ParsedAnalysisResults | null = null;
          if (rawData.analysis_results && typeof rawData.analysis_results === 'string') {
            try {
              parsedAnalysisResults = JSON.parse(rawData.analysis_results);
            } catch (e) {
              console.error("Failed to parse analysis_results:", e);
            }
          } else if (rawData.analysis_results && typeof rawData.analysis_results === 'object') {
            // Assume it's already parsed if it's an object (e.g. by Axios interceptor)
            parsedAnalysisResults = rawData.analysis_results;
          }
          
          let finalCoachingFeedback: string | null = null;
          if (rawData.coaching_feedback && typeof rawData.coaching_feedback === 'string') {
            try {
              // Attempt to parse as JSON, then pretty-print. If not JSON, use as is.
              const parsedFeedback = JSON.parse(rawData.coaching_feedback);
              finalCoachingFeedback = JSON.stringify(parsedFeedback, null, 2);
            } catch (e) {
              // If not valid JSON, assume it's a plain string
              finalCoachingFeedback = rawData.coaching_feedback;
            }
          } else {
            finalCoachingFeedback = rawData.coaching_feedback; // Handles null or already correct type
          }

          const fetchedInterview: Interview = {
            ...rawData,
            analysis_results: parsedAnalysisResults,
            coaching_feedback: finalCoachingFeedback,
          };
          
          setInterview(fetchedInterview);
          console.log("Fetched Interview Data:", fetchedInterview);

          const isProcessing = [
            fetchedInterview.status_transcription,
            fetchedInterview.status_analysis,
            fetchedInterview.status_coaching
          ].some(status => status === 'processing' || status === 'pending');

          if (isProcessing) {
            if (!intervalId) {
              console.log("Polling started for interview processing...");
              intervalId = setInterval(fetchInterviewDetail, 5000);
            }
          } else {
            if (intervalId) {
              console.log("All interview processes finished, stopping poll.");
              clearInterval(intervalId);
              intervalId = null;
            }
          }
          setError(null);
        }
      } catch (err: any) {
        console.error("Error fetching interview detail:", err);
        if (isMounted) {
          if (err.response?.status === 404) {
            setError(`Interview with ID "${id}" not found.`);
          } else {
            setError("Failed to load interview details due to an error.");
          }
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
      fetchInterviewDetail();
    } else {
      setError("Interview ID is missing from URL.");
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
      if (intervalId) {
        console.log("Cleaning up polling interval for interview.");
        clearInterval(intervalId);
      }
    };
  }, [id]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleClick = (e: React.MouseEvent) => {
    if (interview) {
      e.stopPropagation();
      setIsEditingTitle(true);
    }
  };

  const handleTitleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTitle(e.target.value);
  };

  const saveTitle = async () => {
    const newTitleTrimmed = editedTitle.trim();
    if (!interview) {
      setIsEditingTitle(false);
      return;
    }
    if (newTitleTrimmed === "" || newTitleTrimmed === interview.name) {
      setIsEditingTitle(false);
      setEditedTitle(interview.name);
      if (newTitleTrimmed === "" && editedTitle !== "") {
        toast({
          title: "Invalid Title",
          description: "Title cannot be empty.",
          variant: "destructive",
        });
      }
      return;
    }

    const originalTitle = interview.name;
    setInterview(prev => prev ? { ...prev, name: newTitleTrimmed } : null);
    setIsEditingTitle(false);

    try {
      await apiClient.patch(`/interviews/${id}/`, { name: newTitleTrimmed }, {
        headers: { 'Content-Type': 'application/json' }
      });
      toast({
        title: "Title Updated",
        description: "Interview title saved successfully.",
      });
    } catch (err: any) {
      console.error("Error updating title:", err);
      setInterview(prev => prev ? { ...prev, name: originalTitle } : null);
      setEditedTitle(originalTitle);
      toast({
        title: "Error updating title",
        description: err.response?.data?.detail || err.message || "Failed to save title change.",
        variant: "destructive"
      });
    }
  };

  const handleTitleInputBlur = () => {
    saveTitle();
  };

  const handleTitleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveTitle();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      if (interview) setEditedTitle(interview.name);
      setIsEditingTitle(false);
    }
  };
  
  const handleBack = () => {
    navigate('/interviews');
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return "Invalid Date";
    }
  };

  const handleDeleteInterview = async () => {
    if (!interview) return;
    if (!window.confirm("Are you sure you want to delete this interview? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      await apiClient.delete(`/interviews/${interview.id}/`);
      toast({
        title: "Interview Deleted",
        description: `Interview "${interview.name}" has been successfully deleted.`,
        variant: "default",
      });
      navigate("/interviews"); // Navigate back to mock interviews tab
    } catch (err: any) {
      console.error("Error deleting interview:", err);
      toast({
        title: "Error Deleting Interview",
        description:
          err.response?.data?.detail ||
          err.message ||
          "Failed to delete interview. Please try again.",
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center">Loading interview details...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
        <p>Error: {error}</p>
        <Button onClick={handleBack} variant="outline" className="mt-4">Go Back</Button>
      </div>
    );
  }

  if (!interview) {
    return <div className="p-6 text-center">Interview data is unavailable.</div>;
  }

  const { name: title, created_at } = interview;
  const date = formatDate(created_at);

  return (
    <div className="flex flex-col h-screen bg-gray-50 p-0 md:p-6 overflow-hidden">
      <header className="flex items-center justify-between mb-2 md:mb-6 bg-white md:bg-transparent p-4 md:p-0 border-b md:border-b-0">
        <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2 flex-shrink-0">
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
              onClick={(e) => e.stopPropagation()}
              className="text-xl font-semibold bg-transparent border-b border-primary focus:outline-none w-full px-1 py-0.5 -my-0.5"
              aria-label="Edit interview title"
              autoComplete="off"
            />
          ) : (
            <h1
              onClick={handleTitleClick}
              className="text-2xl font-bold truncate cursor-pointer hover:text-primary px-1 py-0.5 -my-0.5"
              title={interview.name}
            >
              {interview.name}
            </h1>
          )}
          <div className="flex items-center text-gray-500 text-sm mt-1">
            <span>{date}</span>
            {/* Duration might not be relevant for the whole interview, or needs calculation */}
          </div>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDeleteInterview} disabled={isDeleting} className="text-red-600 hover:!text-red-600 hover:!bg-red-50 focus:!text-red-600 focus:!bg-red-50">
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                <span>Delete Interview</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Removed Audio Player Section */}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="flex justify-start items-center gap-2 mb-6 shrink-0"> {/* Changed to justify-start */}
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="coaching">Coaching</TabsTrigger>
        </TabsList>

        <TabsContent value="transcript" className="flex-1 overflow-auto">
          <InterviewTranscriptView
            transcriptText={interview.transcription_text}
            status={interview.status_transcription}
            statusDisplay={interview.status_transcription_display}
          />
        </TabsContent>

        <TabsContent value="analysis" className="flex-1 overflow-auto">
          {/* Pass a compatible object to AnalysisPanel */}
          <AnalysisPanel 
            conversation={{ // Constructing an object that AnalysisPanel expects
                id: interview.id,
                name: interview.name,
                created_at: interview.created_at,
                updated_at: interview.updated_at,
                audio_file: null, // Not relevant for this panel's view of interview
                duration: null,   // Not relevant
                status_transcription: interview.status_transcription,
                status_transcription_display: interview.status_transcription_display,
                transcription_text: null, // Not directly used by AnalysisPanel
                status_recap: "n/a",
                status_recap_display: "N/A",
                recap_text: null,
                status_summary: "n/a",
                status_summary_display: "N/A",
                summary_data: null,
                status_analysis: interview.status_analysis,
                status_analysis_display: interview.status_analysis_display,
                analysis_results: interview.analysis_results,
                status_coaching: interview.status_coaching, // Pass along
                status_coaching_display: interview.status_coaching_display, // Pass along
                coaching_feedback: interview.coaching_feedback // Pass along
            } as any} // Use 'as any' for now, or create a more specific adapter/type
          />
        </TabsContent>

        <TabsContent value="coaching" className="flex-1 overflow-auto">
          {/* Pass a compatible object to CoachingView */}
          <CoachingView 
             conversation={{ // Constructing an object that CoachingView expects
                id: interview.id,
                name: interview.name,
                created_at: interview.created_at,
                updated_at: interview.updated_at,
                audio_file: null, 
                duration: null,
                status_transcription: interview.status_transcription,
                status_transcription_display: interview.status_transcription_display,
                transcription_text: null, // CoachingView might not need full transcript segments
                status_recap: "n/a",
                status_recap_display: "N/A",
                recap_text: null,
                status_summary: "n/a",
                status_summary_display: "N/A",
                summary_data: null,
                status_analysis: interview.status_analysis,
                status_analysis_display: interview.status_analysis_display,
                analysis_results: interview.analysis_results,
                status_coaching: interview.status_coaching,
                status_coaching_display: interview.status_coaching_display,
                coaching_feedback: interview.coaching_feedback 
            } as any} // Use 'as any' for now
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InterviewDetail; 