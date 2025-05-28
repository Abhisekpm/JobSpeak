import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Loader2, AlertTriangle, Info } from "lucide-react";

interface InterviewTranscriptViewProps {
  transcriptText: string | null;
  status: string;
  statusDisplay: string;
}

const InterviewTranscriptView: React.FC<InterviewTranscriptViewProps> = ({ transcriptText, status, statusDisplay }) => {
  if (status === 'pending' || status === 'processing') {
    return (
      <Card className="p-6 text-center">
        <div className="flex flex-col items-center justify-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg font-medium">{statusDisplay}...</p>
          <p className="text-sm text-gray-500">The interview transcript is currently being processed.</p>
        </div>
      </Card>
    );
  }

  if (status === 'failed') {
    return (
      <Card className="p-6 text-center border-red-500">
        <div className="flex flex-col items-center justify-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <p className="text-lg font-medium text-red-600">Transcription Failed</p>
          <p className="text-sm text-gray-500">
            {statusDisplay || "Could not process the interview transcript."}
          </p>
          {/* Optionally, display more error info if available and passed via props */}
        </div>
      </Card>
    );
  }

  if (status === 'completed' && !transcriptText) {
    return (
      <Card className="p-6 text-center">
        <div className="flex flex-col items-center justify-center space-y-2">
          <Info className="h-8 w-8 text-gray-400" />
          <p className="text-lg font-medium">Transcript Not Available</p>
          <p className="text-sm text-gray-500">
            The transcription was completed, but no transcript content was found.
          </p>
        </div>
      </Card>
    );
  }

  if (!transcriptText) {
    // Fallback for any other unexpected state with no text
    return (
      <Card className="p-6 text-center">
        <p className="text-lg text-gray-500">No transcript data available for this interview.</p>
      </Card>
    );
  }

  // Render the transcript text, preserving line breaks from the backend (Q&A format)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Full Transcript (Q&A)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose max-w-none whitespace-pre-line">
          {transcriptText}
        </div>
      </CardContent>
    </Card>
  );
};

export default InterviewTranscriptView; 