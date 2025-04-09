import React from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Copy, Download, Loader2, AlertTriangle, CheckCircle } from "lucide-react"; // Icons for status

// Define the minimal Conversation structure needed by this component
interface Conversation {
  recap_text: string | null;
  status_recap: string;
  status_recap_display: string;
}

// Update props to accept the full conversation object (or relevant part)
interface RecapViewProps {
  conversation: Conversation | null;
}

const RecapView: React.FC<RecapViewProps> = ({ conversation }) => {
  // Extract needed data from conversation prop
  const recap = conversation?.recap_text;
  const status = conversation?.status_recap;
  const statusDisplay = conversation?.status_recap_display;

  const handleCopy = () => {
    if (recap) {
      navigator.clipboard.writeText(recap)
        .then(() => { console.log("Recap copied to clipboard!"); })
        .catch(err => { console.error("Failed to copy recap: ", err); });
    }
  };

  const handleExport = () => {
     if (recap) {
         const blob = new Blob([recap], { type: 'text/plain' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = 'recap.txt';
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(url);
         console.log("Exporting recap as text file.");
    } else {
         console.log("No recap data to export.");
    }
  };

  // Helper to render content based on status
  const renderContent = () => {
    // Handle null conversation case first
    if (!conversation) {
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Conversation data not loaded.</p>
          </div>
        );
    }
    
    switch (status) {
      case 'pending':
      case 'processing':
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin mb-2" />
            <p>{statusDisplay || 'Generating recap...'}</p>
          </div>
        );
      case 'completed':
        if (recap && recap.trim() !== '') {
          return (
            <ScrollArea className="flex-grow bg-gray-50 rounded-md p-4 whitespace-pre-wrap">
              {recap}
            </ScrollArea>
          );
        } else {
          return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
               <p>Recap generated, but it appears to be empty.</p>
            </div>
           );
        }
      case 'failed':
        return (
          <div className="flex flex-col items-center justify-center h-full text-red-500">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p>{statusDisplay || 'Recap generation failed'}.</p>
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Recap status is unknown or unavailable.</p>
          </div>
        );
    }
  };

  const canCopyOrExport = status === 'completed' && recap && recap.trim() !== '';

  return (
    <div className="bg-white rounded-lg shadow-md p-4 w-full h-full flex flex-col">
      {/* Header with Title and Actions */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 className="text-xl font-semibold">Recap</h2>
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

export default RecapView; 