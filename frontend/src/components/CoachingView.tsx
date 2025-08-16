import React from 'react';
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { Copy, Loader2, AlertTriangle, Info } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from "./ui/scroll-area";

// Define the coaching feedback JSON structure
interface CoachingFeedback {
  strengths: string[];
  areas_for_improvement: string[];
  actionable_advice: Array<{
    area: string;
    advice: string;
  }>;
  overall_impression: string;
}

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

  // Parse the coaching feedback JSON
  const parsedFeedback: CoachingFeedback | null = React.useMemo(() => {
    if (!coaching_feedback || coaching_feedback.trim() === '') {
      return null;
    }
    
    try {
      const parsed = JSON.parse(coaching_feedback);
      // Validate that it has the expected structure
      if (parsed && typeof parsed === 'object' && 
          'strengths' in parsed && 
          'areas_for_improvement' in parsed && 
          'actionable_advice' in parsed && 
          'overall_impression' in parsed) {
        return parsed as CoachingFeedback;
      } else {
        console.error("Parsed coaching feedback doesn't match expected structure:", parsed);
        return null;
      }
    } catch (error) {
      console.error("Failed to parse coaching feedback JSON:", error);
      return null;
    }
  }, [coaching_feedback]);

  // Handle Copy - copy the formatted text version
  const handleCopy = () => {
    if (parsedFeedback) {
      const formattedText = formatFeedbackForCopy(parsedFeedback);
      navigator.clipboard.writeText(formattedText)
        .then(() => { console.log("Coaching feedback copied to clipboard!"); })
        .catch(err => { console.error("Failed to copy coaching feedback: ", err); });
    }
  };

  // Format feedback for copying as plain text
  const formatFeedbackForCopy = (feedback: CoachingFeedback): string => {
    let text = "COACHING FEEDBACK\n\n";
    
    text += "STRENGTHS:\n";
    feedback.strengths.forEach((strength, index) => {
      text += `${index + 1}. ${strength}\n`;
    });
    
    text += "\nAREAS FOR IMPROVEMENT:\n";
    feedback.areas_for_improvement.forEach((area, index) => {
      text += `${index + 1}. ${area}\n`;
    });
    
    text += "\nACTIONABLE ADVICE:\n";
    feedback.actionable_advice.forEach((advice, index) => {
      text += `${index + 1}. ${advice.area}\n   → ${advice.advice}\n\n`;
    });
    
    text += "OVERALL IMPRESSION:\n";
    text += feedback.overall_impression;
    
    return text;
  };

  // Determine if copy is possible
  const canCopy = status_coaching === 'completed' && parsedFeedback !== null;

  // Handle null conversation case
  if (!conversation) {
      return (
          <Card className="p-4 h-full flex flex-col items-center justify-center">
              <Info className="h-6 w-6 mr-2 text-muted-foreground" /> 
              <p className="text-muted-foreground">Conversation data not available.</p>
          </Card>
      );
  }

  return (
    <Card className="w-full h-full flex flex-col bg-white shadow-md">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-lg m-0">Coaching Feedback</h3>
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!canCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
        </div>
      </CardHeader>
      
      <ScrollArea className="flex-grow min-h-0">
        <CardContent className="pt-4 pb-6 px-6">
          {status_coaching === 'pending' || status_coaching === 'processing' ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" /> Processing...
              </div>
          ) : status_coaching === 'failed' ? (
              <div className="flex flex-col items-center justify-center h-full text-destructive">
                  <AlertTriangle className="h-6 w-6 mr-2" /> Failed to generate coaching feedback.
              </div>
          ) : parsedFeedback ? (
              <div className="space-y-6">
                {/* Strengths Section */}
                <div>
                  <h4 className="text-lg font-semibold text-green-700 mb-3">
                    Strengths
                  </h4>
                  <ul className="space-y-2">
                    {parsedFeedback.strengths.map((strength, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-green-600 mr-2 mt-1">•</span>
                        <span className="text-gray-700">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Areas for Improvement */}
                <div>
                  <h4 className="text-lg font-semibold text-amber-700 mb-3">
                    Areas for Improvement
                  </h4>
                  <ul className="space-y-2">
                    {parsedFeedback.areas_for_improvement.map((area, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-amber-600 mr-2 mt-1">•</span>
                        <span className="text-gray-700">{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Actionable Advice */}
                <div>
                  <h4 className="text-lg font-semibold text-blue-700 mb-3">
                    Actionable Advice
                  </h4>
                  <div className="space-y-4">
                    {parsedFeedback.actionable_advice.map((advice, index) => (
                      <div key={index} className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-400">
                        <h5 className="font-medium text-blue-800 mb-2">{advice.area}</h5>
                        <p className="text-gray-700 text-sm leading-relaxed">{advice.advice}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Overall Impression */}
                <div>
                  <h4 className="text-lg font-semibold text-purple-700 mb-3">
                    Overall Impression
                  </h4>
                  <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-400">
                    <p className="text-gray-700 leading-relaxed">{parsedFeedback.overall_impression}</p>
                  </div>
                </div>
              </div>
          ) : coaching_feedback ? (
              // Fallback for non-JSON coaching feedback (legacy data)
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm mb-2">⚠️ Legacy format detected</p>
                <ReactMarkdown
                  components={{
                      p: ({node, ...props}) => <p {...props} className="mb-4" />
                  }}
                >
                    {coaching_feedback}
                </ReactMarkdown>
              </div>
          ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Info className="h-6 w-6 mr-2" /> Coaching feedback not available.
              </div>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
};

export default CoachingView;