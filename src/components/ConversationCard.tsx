import React, { useState, useRef, useEffect } from "react";
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
  transcriptionPreview?: string;
  onDelete?: () => void;
  onClick?: () => void;
  onTitleChange?: (id: string, newTitle: string) => void;
}

const ConversationCard: React.FC<ConversationCardProps> = ({
  id,
  title = "Team Weekly Standup",
  date = "May 15, 2023",
  duration = "32:45",
  transcriptionPreview = "John: I've been working on the new feature. Sarah: Great progress! I think we should focus on...",
  onDelete = () => console.log("Delete clicked"),
  onClick = () => console.log("Card clicked"),
  onTitleChange = () => {},
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTitle(e.target.value);
  };

  const saveTitle = () => {
    if (editedTitle && editedTitle.trim() !== title && editedTitle.trim() !== "") {
      onTitleChange(id, editedTitle.trim());
    }
    setIsEditing(false);
  };

  const handleInputBlur = () => {
    saveTitle();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveTitle();
    } else if (e.key === 'Escape') {
      setEditedTitle(title);
      setIsEditing(false);
    }
  };

  return (
    <Card
      className="h-[220px] bg-white hover:shadow-lg transition-shadow duration-300 cursor-pointer flex flex-col w-full"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editedTitle}
              onChange={handleTitleChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="text-lg font-bold bg-transparent border-b border-blue-500 focus:outline-none w-full truncate"
              aria-label="Edit conversation title"
            />
          ) : (
            <CardTitle
              onClick={handleTitleClick}
              className="text-lg font-bold truncate cursor-pointer hover:text-blue-600"
              title="Click to edit title"
            >
              {title}
            </CardTitle>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{date}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{duration}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-grow overflow-hidden">
        <CardDescription className="line-clamp-4 text-sm text-gray-600">
          {transcriptionPreview}
        </CardDescription>
      </CardContent>

      <CardFooter className="border-t pt-3 flex justify-between items-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete conversation"
        >
          <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-500" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ConversationCard;
