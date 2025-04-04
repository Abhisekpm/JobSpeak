import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Mic, Pause, Square, Upload } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

interface RecordingControlsProps {
  onRecord?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onUpload?: () => void;
  isRecording?: boolean;
  isPaused?: boolean;
}

const RecordingControls = ({
  onRecord = () => {},
  onPause = () => {},
  onStop = () => {},
  onUpload = () => {},
  isRecording = false,
  isPaused = false,
}: RecordingControlsProps) => {
  const [recordingState, setRecordingState] = useState<
    "idle" | "recording" | "paused"
  >("idle");

  useEffect(() => {
    if (isRecording) {
      setRecordingState(isPaused ? "paused" : "recording");
    } else {
      setRecordingState("idle");
    }
  }, [isRecording, isPaused]);

  const handleRecord = () => {
    onRecord();
  };

  const handlePause = () => {
    onPause();
  };

  const handleStop = () => {
    onStop();
  };

  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-white rounded-lg shadow-sm">
      <TooltipProvider>
        {recordingState === "idle" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleRecord}
                variant="outline"
                size="icon"
                className="border-2 border-red-500 text-red-500 hover:bg-red-50 rounded-full flex items-center justify-center"
              >
                <Mic className="h-6 w-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Start Recording</p>
            </TooltipContent>
          </Tooltip>
        ) : recordingState === "recording" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handlePause}
                variant="outline"
                size="icon"
                className="border-2 border-amber-500 text-amber-500 hover:bg-amber-50 rounded-full flex items-center justify-center"
              >
                <Pause className="h-6 w-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Pause Recording</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleRecord}
                variant="outline"
                size="icon"
                className="border-2 border-green-500 text-green-500 hover:bg-green-50 rounded-full flex items-center justify-center"
              >
                <Mic className="h-6 w-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Resume Recording</p>
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleStop}
              variant="outline"
              size="icon"
              className={`border-2 border-red-500 text-red-500 hover:bg-red-50 rounded-full flex items-center justify-center ${recordingState === "idle" ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={recordingState === "idle"}
            >
              <Square className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Stop Recording</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default RecordingControls;
