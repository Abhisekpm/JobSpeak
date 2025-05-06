import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./ui/card";
import { Button } from "./ui/button";
import { Trash2, Clock, Calendar } from "lucide-react";

interface ConversationCardProps {
  id: string;
  title?: string;
  date?: string;
  duration?: string;
  previewText?: string;
  onClick?: () => void;
  transcriptionPreview?: string;
}

const ConversationCard: React.FC<ConversationCardProps> = ({
  id,
  title = "Untitled Conversation",
  date = "N/A",
  duration = "--:--",
  previewText = "No preview available.",
  onClick,
}) => {
  return (
    <Card
      className="flex flex-col justify-between h-full shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer bg-white rounded-lg overflow-hidden"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-gray-800 truncate">
          {title}
        </CardTitle>
        <div className="flex items-center text-xs text-gray-500 mt-1 space-x-3">
          <div className="flex items-center">
            <Calendar className="w-3.5 h-3.5 mr-1" />
            <span>{date}</span>
          </div>
          <div className="flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1" />
            <span>{duration}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow pb-3">
        <CardDescription className="text-sm text-gray-600 line-clamp-3">
          {previewText}
        </CardDescription>
      </CardContent>
    </Card>
  );
};

export default ConversationCard;
