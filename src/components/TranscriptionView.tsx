import React from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Copy, Download, Loader2, AlertTriangle, CheckCircle } from "lucide-react"; // Icons for status

// Define props for the simplified view
interface TranscriptionViewProps {
  transcription: string | null | undefined;
  status: string | null | undefined; // e.g., 'pending', 'processing', 'completed', 'failed'
  statusDisplay: string | null | undefined; // e.g., 'Pending', 'Processing', ...
}

const TranscriptionView: React.FC<TranscriptionViewProps> = ({
  transcription,
  status,
  statusDisplay
}) => {

  const handleCopy = () => {
    if (transcription) {
      navigator.clipboard.writeText(transcription)
        .then(() => {
          // Optionally show a toast message for success
          console.log("Transcription copied to clipboard!");
        })
        .catch(err => {
          console.error("Failed to copy transcription: ", err);
          // Optionally show an error toast
        });
    }
  };

  // Placeholder for export functionality
  const handleExport = () => {
    console.log("Export transcription clicked");
    // TODO: Implement actual export logic (e.g., download as .txt)
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
        if (transcription && transcription.trim() !== '') {
          // Display the transcription text within a scrollable area
          return (
            <ScrollArea className="flex-grow bg-gray-50 rounded-md p-4 whitespace-pre-wrap">
              {transcription}
            </ScrollArea>
          );
        } else {
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
