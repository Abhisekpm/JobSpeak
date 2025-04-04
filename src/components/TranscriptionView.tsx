import React, { useState } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Clock, User, Download, Copy, Edit } from "lucide-react";

interface Speaker {
  id: string;
  name: string;
  color: string;
}

interface TranscriptSegment {
  id: string;
  speakerId: string;
  startTime: number;
  endTime: number;
  text: string;
}

interface TranscriptionViewProps {
  segments?: TranscriptSegment[];
  speakers?: Speaker[];
  isEditable?: boolean;
  onEditSegment?: (segmentId: string, newText: string) => void;
  onEditSpeaker?: (speakerId: string, newName: string) => void;
}

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const TranscriptionView: React.FC<TranscriptionViewProps> = ({
  segments = [
    {
      id: "1",
      speakerId: "speaker1",
      startTime: 0,
      endTime: 15,
      text: "Hello, I'm calling about the new product launch. Can you tell me more about the features?",
    },
    {
      id: "2",
      speakerId: "speaker2",
      startTime: 16,
      endTime: 45,
      text: "Of course! Our new product includes advanced AI capabilities, seamless integration with existing systems, and a user-friendly interface designed for maximum productivity.",
    },
    {
      id: "3",
      speakerId: "speaker1",
      startTime: 46,
      endTime: 60,
      text: "That sounds impressive. What about pricing options?",
    },
    {
      id: "4",
      speakerId: "speaker2",
      startTime: 61,
      endTime: 90,
      text: "We offer flexible pricing tiers based on your organization's needs. The basic package starts at $99 per month, while our premium enterprise solution is $299 monthly with additional customization options.",
    },
    {
      id: "5",
      speakerId: "speaker1",
      startTime: 91,
      endTime: 105,
      text: "Great, and is there a trial period available?",
    },
    {
      id: "6",
      speakerId: "speaker2",
      startTime: 106,
      endTime: 130,
      text: "Yes, we offer a 14-day free trial with full access to all features. No credit card required to get started.",
    },
  ],
  speakers = [
    { id: "speaker1", name: "Customer", color: "#4f46e5" },
    { id: "speaker2", name: "Sales Rep", color: "#10b981" },
  ],
  isEditable = false,
  onEditSegment = () => {},
  onEditSpeaker = () => {},
}) => {
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const handleEditClick = (segment: TranscriptSegment) => {
    setEditingSegmentId(segment.id);
    setEditText(segment.text);
  };

  const handleSaveEdit = () => {
    if (editingSegmentId) {
      onEditSegment(editingSegmentId, editText);
      setEditingSegmentId(null);
    }
  };

  const getSpeakerById = (id: string) => {
    return (
      speakers.find((speaker) => speaker.id === id) || {
        name: "Unknown",
        color: "#888888",
      }
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Conversation Transcript</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-grow bg-gray-50 rounded-md p-2">
        <div className="space-y-4 p-2">
          {segments.map((segment) => {
            const speaker = getSpeakerById(segment.speakerId);
            return (
              <div key={segment.id} className="group">
                <div className="flex items-start gap-2">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: speaker.color }}
                  >
                    {speaker.name.charAt(0)}
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-medium"
                        style={{ color: speaker.color }}
                      >
                        {speaker.name}
                      </span>
                      <div className="flex items-center text-gray-500 text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        <span>
                          {formatTime(segment.startTime)} -{" "}
                          {formatTime(segment.endTime)}
                        </span>
                      </div>
                    </div>

                    {editingSegmentId === segment.id ? (
                      <div className="mt-1">
                        <textarea
                          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={3}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingSegmentId(null)}
                          >
                            Cancel
                          </Button>
                          <Button size="sm" onClick={handleSaveEdit}>
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <p className="text-gray-700 mt-1">{segment.text}</p>
                        {isEditable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleEditClick(segment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Speakers:</span>
          <div className="flex flex-wrap gap-2">
            {speakers.map((speaker) => (
              <div
                key={speaker.id}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-sm"
                style={{
                  backgroundColor: `${speaker.color}20`,
                  color: speaker.color,
                }}
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: speaker.color }}
                />
                {speaker.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptionView;
