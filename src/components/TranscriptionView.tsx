import React from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Copy, Download, Loader2, AlertTriangle, CheckCircle } from "lucide-react"; // Icons for status

// Define the structure of a single transcription segment
interface TranscriptionSegment {
  speaker: number;
  transcript: string;
}

// Define props for the simplified view
interface TranscriptionViewProps {
  transcription: string | null | undefined; // This will now be a JSON string
  status: string | null | undefined; // e.g., 'pending', 'processing', 'completed', 'failed'
  statusDisplay: string | null | undefined; // e.g., 'Pending', 'Processing', ...
}

const TranscriptionView: React.FC<TranscriptionViewProps> = ({
  transcription,
  status,
  statusDisplay
}) => {

  // Helper function to parse and validate the transcription JSON
  const parseTranscription = (): TranscriptionSegment[] | null => {
    if (!transcription) return null;
    try {
      const parsed = JSON.parse(transcription);
      // Basic validation: check if it's an array and elements have speaker/transcript
      if (Array.isArray(parsed) && parsed.every(seg => typeof seg.speaker === 'number' && typeof seg.transcript === 'string')) {
        return parsed;
      }
      console.error("Parsed transcription is not a valid segment array:", parsed);
      return null;
    } catch (error) {
      console.error("Failed to parse transcription JSON:", error);
      return null;
    }
  };

  // Function to format the parsed transcription for copying
  const formatForCopy = (segments: TranscriptionSegment[] | null): string => {
    if (!segments) return "";
    return segments.map(seg => `Speaker ${seg.speaker}: ${seg.transcript}`).join("\n\n");
  };

  const handleCopy = () => {
    const parsedSegments = parseTranscription();
    const textToCopy = formatForCopy(parsedSegments);

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          console.log("Formatted transcription copied to clipboard!");
        })
        .catch(err => {
          console.error("Failed to copy formatted transcription: ", err);
        });
    } else if (transcription) {
        // Fallback: Copy raw string if parsing/formatting failed but original string exists
         navigator.clipboard.writeText(transcription)
        .then(() => {
          console.log("Copied raw transcription data to clipboard.");
        })
        .catch(err => {
          console.error("Failed to copy raw transcription data: ", err);
        });
    }
  };

  // Placeholder for export functionality (could also use formatted text)
  const handleExport = () => {
    const parsedSegments = parseTranscription();
    const textToExport = formatForCopy(parsedSegments);
    if (textToExport) {
         // Basic TXT download implementation
         const blob = new Blob([textToExport], { type: 'text/plain' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = 'transcription.txt';
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(url);
         console.log("Exporting formatted transcription as text file.");
    } else {
         console.log("No valid transcription data to export.");
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
        const parsedSegments = parseTranscription();

        if (parsedSegments && parsedSegments.length > 0) {
          // Display the parsed transcription segments
          return (
            <ScrollArea className="flex-grow bg-gray-50 rounded-md p-4">
              {parsedSegments.map((segment, index) => (
                <div key={index} className="mb-3">
                  <span className="font-semibold mr-2">{`Speaker ${segment.speaker}:`}</span>
                  <span>{segment.transcript}</span>
                </div>
              ))}
            </ScrollArea>
          );
        } else if (transcription) { 
             // Handle case where parsing failed but original data exists
              return (
                <div className="flex flex-col items-center justify-center h-full text-orange-500">
                    <AlertTriangle className="h-8 w-8 mb-2" />
                    <p>Transcription complete, but the format is unexpected or invalid.</p>
                    <p className="text-xs text-gray-400 mt-1">Raw data might be available for copy/export.</p>
                </div>
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

  const canCopyOrExport = status === 'completed' && transcription && transcription.trim() !== '';

  return (
    <div className="bg-white rounded-lg shadow-md p-4 w-full h-full flex flex-col">
      {/* Header with Title and Actions */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 className="text-xl font-semibold">Conversation Transcript</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!canCopyOrExport}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!canCopyOrExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

export default TranscriptionView;
