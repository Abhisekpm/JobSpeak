import React from 'react';
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Copy, Loader2, AlertTriangle, Info } from "lucide-react";
import ReactMarkdown from 'react-markdown';

// Define the minimal Conversation structure needed
interface Conversation {
  status_coaching: string;
  coaching_feedback: string | null;
}

// Props interface
interface CoachingViewProps {
  conversation: Conversation | null;
}

const CoachingView: React.FC<CoachingViewProps> = ({ conversation }) => {

  const status_coaching = conversation?.status_coaching;
  const coaching_feedback = conversation?.coaching_feedback;

  // Handle Copy
  const handleCopy = () => {
    if (coaching_feedback) {
      navigator.clipboard.writeText(coaching_feedback)
        .then(() => { console.log("Coaching feedback copied to clipboard!"); })
        .catch(err => { console.error("Failed to copy coaching feedback: ", err); });
    }
  };

  // Determine if copy is possible
  const canCopy = status_coaching === 'completed' && coaching_feedback && coaching_feedback.trim() !== '';

  // Handle null conversation case
  if (!conversation) {
      return (
          <Card className="p-4 h-full flex items-center justify-center">
              <Info className="h-6 w-6 mr-2 text-muted-foreground" /> 
              <p className="text-muted-foreground">Conversation data not available.</p>
          </Card>
      );
  }

  return (
    <Card className="p-4 h-full overflow-y-auto prose max-w-none flex flex-col">
       {/* Header Section */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0 not-prose">
        <h3 className="font-semibold text-lg m-0">Coaching Feedback</h3>
        <Button variant="outline" size="sm" onClick={handleCopy} disabled={!canCopy}>
          <Copy className="h-4 w-4 mr-2" />
          Copy
        </Button>
      </div>
      
      {/* Content Section */}
      <div className="flex-grow overflow-hidden">
        {status_coaching === 'pending' || status_coaching === 'processing' ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Processing...
            </div>
        ) : status_coaching === 'failed' ? (
            <div className="flex flex-col items-center justify-center h-32 text-destructive">
                <AlertTriangle className="h-6 w-6 mr-2" /> Failed to generate coaching feedback.
            </div>
        ) : coaching_feedback ? (
            <ReactMarkdown
              components={{
                  p: ({node, ...props}) => <p {...props} className="mb-4" />
              }}
            >
                {coaching_feedback}
            </ReactMarkdown>
        ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
                <Info className="h-6 w-6 mr-2" /> Coaching feedback not available.
            </div>
        )}
      </div>
    </Card>
  );
};

export default CoachingView; 