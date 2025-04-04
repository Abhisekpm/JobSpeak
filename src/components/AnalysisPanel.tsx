import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { cn } from "../lib/utils";
import {
  BarChart,
  PieChart,
  Activity,
  MessageSquare,
  Clock,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

interface AnalysisPanelProps {
  talkTimeRatio?: {
    speaker1: number;
    speaker2: number;
  };
  sentiment?: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topics?: Array<{
    name: string;
    relevance: number;
  }>;
  keywords?: Array<{
    word: string;
    count: number;
  }>;
}

const AnalysisPanel = ({
  talkTimeRatio = { speaker1: 65, speaker2: 35 },
  sentiment = { positive: 45, neutral: 40, negative: 15 },
  topics = [
    { name: "Product Features", relevance: 85 },
    { name: "Pricing", relevance: 70 },
    { name: "Customer Support", relevance: 60 },
    { name: "Competitors", relevance: 40 },
  ],
  keywords = [
    { word: "integration", count: 12 },
    { word: "pricing", count: 8 },
    { word: "timeline", count: 7 },
    { word: "support", count: 6 },
    { word: "features", count: 5 },
  ],
}: AnalysisPanelProps) => {
  return (
    <Card className="w-full h-full bg-white shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Conversation Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="topics">Topics</TabsTrigger>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Talk Time Distribution
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span>Speaker 1</span>
                    <span>{talkTimeRatio.speaker1}%</span>
                  </div>
                  <Progress value={talkTimeRatio.speaker1} className="h-2" />

                  <div className="flex justify-between items-center text-sm">
                    <span>Speaker 2</span>
                    <span>{talkTimeRatio.speaker2}%</span>
                  </div>
                  <Progress value={talkTimeRatio.speaker2} className="h-2" />
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Sentiment Analysis
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center p-2 rounded-md bg-green-50">
                    <ThumbsUp className="h-5 w-5 text-green-500 mb-1" />
                    <span className="text-xs text-muted-foreground">
                      Positive
                    </span>
                    <span className="font-medium">{sentiment.positive}%</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-md bg-gray-50">
                    <div className="h-5 w-5 rounded-full border border-gray-300 mb-1" />
                    <span className="text-xs text-muted-foreground">
                      Neutral
                    </span>
                    <span className="font-medium">{sentiment.neutral}%</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-md bg-red-50">
                    <ThumbsDown className="h-5 w-5 text-red-500 mb-1" />
                    <span className="text-xs text-muted-foreground">
                      Negative
                    </span>
                    <span className="font-medium">{sentiment.negative}%</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="topics" className="space-y-4">
            <div>
              <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                <PieChart className="h-4 w-4 text-muted-foreground" />
                Key Topics Identified
              </h3>
              <div className="space-y-3">
                {topics.map((topic, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                      <span>{topic.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {topic.relevance}% relevance
                      </span>
                    </div>
                    <Progress value={topic.relevance} className="h-2" />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="keywords" className="space-y-4">
            <div>
              <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                <BarChart className="h-4 w-4 text-muted-foreground" />
                Frequently Used Keywords
              </h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {keywords.map((keyword, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className={cn(
                      "py-1 px-2 text-xs",
                      keyword.count > 10
                        ? "bg-primary/10 border-primary/20"
                        : "",
                    )}
                  >
                    {keyword.word} ({keyword.count})
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AnalysisPanel;
