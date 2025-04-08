import React, { useState } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Copy, Download, Loader2, AlertTriangle, CheckCircle } from "lucide-react"; // Icons for status
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"; // Import Tabs components

// Define the structure for the summary data
interface SummaryData {
  short: string | null | undefined;
  balanced: string | null | undefined;
  detailed: string | null | undefined;
}

// Update props for the summary view
interface SummaryViewProps {
  summaryData: SummaryData | null | undefined;
  status: string | null | undefined; // e.g., 'pending', 'processing', 'completed', 'failed'
  statusDisplay: string | null | undefined; // e.g., 'Pending', 'Processing', ...
}

const SummaryView: React.FC<SummaryViewProps> = ({
  summaryData,
  status,
  statusDisplay
}) => {
  // State to track the active inner summary tab
  const [activeTab, setActiveTab] = useState<keyof SummaryData>('balanced');

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

  const handleExport = () => {
     const textToExport = getActiveSummaryText();
     if (textToExport) {
         const blob = new Blob([textToExport], { type: 'text/plain' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `summary-${activeTab}.txt`; // Include tab type in filename
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(url);
         console.log(`Exporting summary (${activeTab}) as text file.`);
    } else {
         console.log(`No summary data (${activeTab}) to export.`);
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
            <p>{statusDisplay || 'Generating summary...'}</p>
          </div>
        );
      case 'completed':
        if (!summaryData) {
           return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
               <p>Summary generated, but data is unavailable.</p>
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
            <div className="flex-grow overflow-hidden mt-4">
              <TabsContent value="short" className="h-full">
                <SummaryDisplay text={summaryData.short} />
              </TabsContent>
              <TabsContent value="balanced" className="h-full">
                <SummaryDisplay text={summaryData.balanced} />
              </TabsContent>
              <TabsContent value="detailed" className="h-full">
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
        <ScrollArea className="bg-gray-50 rounded-md p-4 whitespace-pre-wrap h-full">
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
  const canCopyOrExport = status === 'completed' && activeSummaryText && activeSummaryText.trim() !== '';

  return (
    <div className="bg-white rounded-lg shadow-md p-4 w-full h-full flex flex-col">
      {/* Header with Title and Actions */}
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        <h2 className="text-xl font-semibold">Summary</h2>
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

      {/* Content Area (will contain status or tabs) */}
      <div className="flex-grow overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

export default SummaryView; 