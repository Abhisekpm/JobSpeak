import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  Activity,
  MessageSquare,
  Clock,
  Info,
  List,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface Conversation {
  id: number;
  name: string;
  status_analysis: string;
  status_analysis_display: string;
  analysis_results: {
    talk_time_ratio: { [speaker: string]: number } | null;
    sentiment: { label: string; reasoning: string } | null;
    topics: string[] | null;
  } | null;
}

interface AnalysisPanelProps {
  conversation: Conversation | null;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ conversation }) => {

  if (!conversation) {
    return (
        <Card className="w-full h-full flex flex-col items-center justify-center bg-white shadow-md p-6">
            <Info className="h-8 w-8 text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-medium">No Conversation Data</p>
            <p className="text-muted-foreground text-sm text-center mt-1">
                Waiting for conversation details to load...
            </p>
        </Card>
    );
  }

  const { status_analysis, analysis_results } = conversation;

  if (status_analysis === 'pending' || status_analysis === 'processing') {
    return (
      <Card className="w-full h-full flex flex-col items-center justify-center bg-white shadow-md p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">
          {status_analysis === 'pending' ? "Analysis Pending..." : "Processing Analysis..."}
        </p>
      </Card>
    );
  }

  if (status_analysis === 'failed') {
    return (
      <Card className="w-full h-full flex flex-col items-center justify-center bg-white shadow-md p-6">
        <AlertCircle className="h-8 w-8 text-destructive mb-4" />
        <p className="text-destructive font-medium">Analysis Failed</p>
        <p className="text-muted-foreground text-sm text-center mt-1">
          Could not generate analysis for this conversation.
        </p>
      </Card>
    );
  }

  if (!analysis_results || 
      (!analysis_results.talk_time_ratio && !analysis_results.sentiment && !analysis_results.topics)) 
  {
    return (
      <Card className="w-full h-full flex flex-col items-center justify-center bg-white shadow-md p-6">
         <Info className="h-8 w-8 text-muted-foreground mb-4" />
         <p className="text-muted-foreground font-medium">Analysis Not Available</p>
         <p className="text-muted-foreground text-sm text-center mt-1">
           Analysis data could not be generated or is empty for this completed conversation.
         </p>
       </Card>
    );
  }

  const { talk_time_ratio, sentiment, topics } = analysis_results;

  return (
    <Card className="w-full h-full bg-white shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Conversation Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {talk_time_ratio && Object.keys(talk_time_ratio).length > 0 && (
            <div>
              <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Talk Time Distribution
              </h3>
              <div className="space-y-3">
                {Object.entries(talk_time_ratio).map(([speaker, percentage]) => (
                  <div key={speaker} className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="capitalize">{speaker.replace('_', ' ')}</span>
                      <span>{percentage}%</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {talk_time_ratio && Object.keys(talk_time_ratio).length > 0 && sentiment && <Separator className="my-4" />}

          {sentiment && (
            <div>
              <h3 className="text-sm font-medium flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Overall Sentiment
              </h3>
              <div className="flex items-start gap-3 p-3 rounded-md border bg-muted/50">
                 <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                 <div>
                     <p className="text-sm font-medium">{sentiment.label || "Unknown"}</p>
                     <p className="text-sm text-muted-foreground italic">
                         {sentiment.reasoning || "No reasoning provided."}
                     </p>
                 </div>
              </div>
            </div>
          )}

          {sentiment && topics && topics.length > 0 && <Separator className="my-4" />}

          {topics && topics.length > 0 && (
            <div>
              <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                <List className="h-4 w-4 text-muted-foreground" />
                Key Topics Identified
              </h3>
              <div className="flex flex-wrap gap-2">
                {topics.map((topic, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="py-1 px-2 text-xs font-normal"
                  >
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalysisPanel;
