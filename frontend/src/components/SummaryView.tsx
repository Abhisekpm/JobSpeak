import React, { useState } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Copy, Loader2, AlertTriangle, CheckCircle } from "lucide-react"; // Icons for status
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"; // Import Tabs components

// Define the structure for the summary data within the conversation object
interface SummaryData {
  short: string | null | undefined;
  balanced: string | null | undefined;
  detailed: string | null | undefined;
}

// Define the minimal Conversation structure needed by this component
interface Conversation {
  summary_data: SummaryData | null;
  status_summary: string;
  status_summary_display: string;
}

// Update props to accept the full conversation object (or relevant part)
interface SummaryViewProps {
  conversation: Conversation | null;
}

const SummaryView: React.FC<SummaryViewProps> = ({ conversation }) => {
  // State to track the active inner summary tab
  const [activeTab, setActiveTab] = useState<keyof SummaryData>('balanced');

  // Extract needed data from conversation prop
  const summaryData = conversation?.summary_data;
  const status = conversation?.status_summary;
  const statusDisplay = conversation?.status_summary_display;

  // Get the text of the currently active tab
  const getActiveSummaryText = () => {
    if (!summaryData) return null;
    return summaryData[activeTab];
  };

  const handleCopy = () => {
    const textToCopy = getActiveSummaryText();
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => { console.log(`Summary (${activeTab}) copied to clipboard!`); })
        .catch(err => { console.error(`Failed to copy summary (${activeTab}): `, err); });
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
            <p>{statusDisplay || 'Generating summary...'}</p>
          </div>
        );
      case 'completed':
        // Check specifically for summaryData within the loaded conversation
        if (!summaryData || (!summaryData.short && !summaryData.balanced && !summaryData.detailed)) {
           return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
               <p>Summary generated, but data is unavailable or empty.</p>
            </div>
           );
        }
        // Render inner tabs if status is completed and data exists
        return (
          <Tabs defaultValue="balanced" value={activeTab} onValueChange={(value) => setActiveTab(value as keyof SummaryData)} className="flex flex-col h-full">
            <TabsList className="flex-shrink-0 justify-center px-1 w-full bg-gray-100 rounded-md p-1">
              <TabsTrigger value="short" className="data-[state=active]:bg-white data-[state=active]:text-primary">Short</TabsTrigger>
              <TabsTrigger value="balanced" className="data-[state=active]:bg-white data-[state=active]:text-primary">Balanced</TabsTrigger>
              <TabsTrigger value="detailed" className="data-[state=active]:bg-white data-[state=active]:text-primary">Detailed</TabsTrigger>
            </TabsList>
            <div className="flex-grow min-h-0 relative mt-4">
              <TabsContent value="short" className="absolute inset-0">
                <SummaryDisplay text={summaryData.short} />
              </TabsContent>
              <TabsContent value="balanced" className="absolute inset-0">
                <SummaryDisplay text={summaryData.balanced} />
              </TabsContent>
              <TabsContent value="detailed" className="absolute inset-0">
                <SummaryDisplay text={summaryData.detailed} />
              </TabsContent>
            </div>
          </Tabs>
        );
      case 'failed':
        return (
          <div className="flex flex-col items-center justify-center h-full text-red-500">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p>{statusDisplay || 'Summary generation failed'}.</p>
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Summary status is unknown or unavailable.</p>
          </div>
        );
    }
  };

  // Helper component to display summary text or empty state
  const SummaryDisplay: React.FC<{ text: string | null | undefined }> = ({ text }) => {
    if (text && text.trim() !== '') {
      return (
        <ScrollArea className="h-full bg-gray-50 rounded-md p-4 whitespace-pre-wrap">
          {text}
        </ScrollArea>
      );
    } else {
      return (
        <div className="flex items-center justify-center h-full text-gray-400 p-4">
          <p>This summary is not available.</p>
        </div>
      );
    }
  };

  const activeSummaryText = getActiveSummaryText();
  const canCopy = status === 'completed' && activeSummaryText && activeSummaryText.trim() !== '';

  return (
    <div className="bg-white rounded-lg shadow-md p-4 w-full h-full flex flex-col">
      {/* Header with Title and Actions */}
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        <h2 className="text-xl font-semibold">Summary</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!canCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
        </div>
      </div>

      {/* Content Area (will contain status or tabs) */}
      <div className="flex-grow min-h-0 relative">
        {renderContent()}
      </div>
    </div>
  );
};

export default SummaryView; 