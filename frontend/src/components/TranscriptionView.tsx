import React from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Copy, Loader2, AlertTriangle, CheckCircle } from "lucide-react"; // Icons for status

// Define the structure of a single transcription segment
// This should match the structure within the JSON blob from the backend
interface TranscriptionSegment {
  speaker: number | string; // Allow string or number for speaker ID
  transcript: string;
  // Add other potential fields if they exist in your JSON (e.g., start_time, end_time)
}

// Define props for the simplified view
interface TranscriptionViewProps {
  // Update type to expect the parsed JSON object (or null)
  transcription: TranscriptionSegment[] | null | undefined; 
  status: string | null | undefined; // e.g., 'pending', 'processing', 'completed', 'failed'
  statusDisplay: string | null | undefined; // e.g., 'Pending', 'Processing', ...
}

const TranscriptionView: React.FC<TranscriptionViewProps> = ({
  transcription, // This prop is now the already parsed array (or null)
  status,
  statusDisplay
}) => {

  // Remove debug logging now that the issue is identified and fixed

  // Helper function removed - parsing happens in parent or before passing prop
  // const parseTranscription = (): TranscriptionSegment[] | null => { ... };

  // Function to format the transcription for copying
  const formatForCopy = (segments: TranscriptionSegment[] | null): string => {
    if (!segments) return "";
    // Use a consistent format, handle potential string/number speakers
    return segments.map(seg => `Speaker ${seg.speaker}: ${seg.transcript}`).join("\n\n");
  };

  const handleCopy = () => {
    // Use the prop directly
    const textToCopy = formatForCopy(transcription);

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          // Optional: show success toast
          console.log("Formatted transcription copied to clipboard!");
        })
        .catch(err => {
          console.error("Failed to copy formatted transcription: ", err);
          // Optional: show error toast
        });
    }
  };

  // Helper to render content based on status
  const renderContent = () => {
    switch (status) {
      case 'pending':
      case 'processing':
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin mb-2" />
            <p>{statusDisplay || 'Processing transcription...'}</p>
          </div>
        );
      case 'completed':
        // Use the transcription prop directly
        if (transcription && transcription.length > 0) {
          return (
            <ScrollArea className="absolute inset-0 bg-gray-50 rounded-md p-4">
              {transcription.map((segment, index) => (
                <div key={index} className="mb-3">
                  {/* Handle potential string/number speaker IDs */}
                  <span className="font-semibold mr-2">{`Speaker ${segment.speaker}:`}</span>
                  <span>{segment.transcript}</span>
                </div>
              ))}
            </ScrollArea>
          );
        } else {
          // Handle case where status is completed but transcription is null/empty
          return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
               <p>Transcription complete, but no text was generated.</p>
            </div>
           );
        }
      case 'failed':
        return (
          <div className="flex flex-col items-center justify-center h-full text-red-500">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p>{statusDisplay || 'Transcription failed'}. Please check the audio file or try again.</p>
          </div>
        );
      default:
        // Default case if status is null, undefined, or unexpected
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Transcription status is unknown or unavailable.</p>
          </div>
        );
    }
  };

  // Rename variable and update condition
  const canCopy = status === 'completed' && transcription && transcription.length > 0;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 w-full h-full flex flex-col">
      {/* Header with Title and Actions */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 className="text-xl font-semibold">Conversation Transcript</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!canCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow min-h-0 relative">
        {renderContent()}
      </div>
    </div>
  );
};

export default TranscriptionView;
