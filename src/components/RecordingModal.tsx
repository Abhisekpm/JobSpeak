import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { X } from "lucide-react";
import WaveformVisualizer from "./WaveformVisualizer";
import RecordingControls from "./RecordingControls";

interface RecordingModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSave?: (data: { title: string; audio: Blob; duration: number }) => void | Promise<void>;
  isSaving?: boolean;
}

const RecordingModal = ({
  isOpen = false,
  onClose = () => {},
  onSave = () => {},
  isSaving = false,
}: RecordingModalProps) => {
  const [activeTab, setActiveTab] = useState<"record" | "upload">("record");
  const [title, setTitle] = useState<string>("");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [audioData, setAudioData] = useState<number[]>([]);

  const timerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock audio data for visualization
  useEffect(() => {
    if (isRecording && !isPaused) {
      const interval = setInterval(() => {
        setAudioData(
          Array(50)
            .fill(0)
            .map(() => Math.random() * 100),
        );
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isRecording, isPaused]);

  // Timer for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setDuration((prevDuration) => prevDuration + 1);
        // Simulate audio data for waveform during recording
        setAudioData((prevData) => [
          ...prevData.slice(-100), // Keep last 100 points
          Math.random() * 100,
        ]);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, isPaused]);

  // Mock recording functionality
  const startRecording = async () => {
    try {
      // In a real implementation, we would use the MediaRecorder API
      // This is a simplified mock version
      setIsRecording(true);
      setIsPaused(false);
      audioChunksRef.current = [];

      // Simulate getting microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create a MediaRecorder instance
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav",
        });
        setAudioBlob(audioBlob);
      };

      mediaRecorder.start();
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        setIsPaused(true);
        mediaRecorderRef.current.pause();
        console.log("MediaRecorder paused successfully.");
      } catch (error) {
        console.error("Error pausing MediaRecorder:", error);
        // Optionally revert state if pause fails
        // setIsPaused(false);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      try {
        setIsPaused(false);
        mediaRecorderRef.current.resume();
        console.log("MediaRecorder resumed successfully.");
      } catch (error) {
        console.error("Error resuming MediaRecorder:", error);
        // Optionally revert state if resume fails
        // setIsPaused(true);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        setIsRecording(false);
        setIsPaused(false);
        mediaRecorderRef.current.stop();
        console.log("MediaRecorder stopped successfully.");

        // Stop all tracks on the stream
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream
            .getTracks()
            .forEach((track) => track.stop());
          console.log("Media stream tracks stopped.");
        }
      } catch (error) {
        console.error("Error stopping MediaRecorder:", error);
        // Optionally try to reset state anyway
        // setIsRecording(false);
        // setIsPaused(false);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      // In a real implementation, we would process the audio file
      // For now, we'll just set some mock data
      setAudioData(
        Array(50)
          .fill(0)
          .map(() => Math.random() * 100),
      );
      setDuration(Math.floor(Math.random() * 180)); // Random duration between 0-180 seconds
    }
  };

  const handleSave = async () => {
    // Prevent saving if already saving
    if (isSaving) return; 

    let saveData: { title: string; audio: Blob; duration: number } | null = null;

    if (activeTab === "record" && audioBlob) {
      saveData = {
        title: title || "Untitled Recording",
        audio: audioBlob,
        duration: duration,
      };
    } else if (activeTab === "upload" && uploadedFile) {
      // For upload, we might want to pass the File object directly
      // or read it as a Blob if the onSave handler expects a Blob
      // Assuming onSave can handle a File for now, let's pass it as Blob for consistency
      const uploadedBlob = new Blob([uploadedFile], { type: uploadedFile.type });
      saveData = {
        title: title || uploadedFile.name,
        audio: uploadedBlob, // Pass Blob
        duration: duration, // Duration might need calculation for uploaded files
      };
    }

    if (saveData) {
      try {
        await onSave(saveData);
        // Only reset and close if save was successful (onSave didn't throw)
        // If onSave is not async or doesn't throw, this always runs
        resetState();
        // onClose(); // Let parent handle closing after successful save
      } catch (error) {
        // Error handled in parent (home.tsx)
        console.error("onSave handler threw an error:", error);
        // Do not close the modal or reset state if onSave failed
      }
    }
  };

  const resetState = () => {
    setTitle("");
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setAudioBlob(null);
    setUploadedFile(null);
    setAudioData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    resetState();
    onClose();
  };

  const handleRecordingControls = {
    onRecord: isRecording && isPaused ? resumeRecording : startRecording,
    onPause: pauseRecording,
    onStop: stopRecording,
    onUpload: () => fileInputRef.current?.click(),
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Record Conversation
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "record" | "upload")}
          className="mt-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="record">Record Audio</TabsTrigger>
            <TabsTrigger value="upload">Upload Audio</TabsTrigger>
          </TabsList>

          <TabsContent value="record" className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="recording-title">Recording Title</Label>
              <Input
                id="recording-title"
                placeholder="Enter a title for your recording"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isRecording}
              />
            </div>

            <WaveformVisualizer
              audioData={audioData}
              isRecording={isRecording}
              isPaused={isPaused}
              duration={duration}
            />

            <RecordingControls
              isRecording={isRecording}
              isPaused={isPaused}
              onRecord={handleRecordingControls.onRecord}
              onPause={handleRecordingControls.onPause}
              onStop={handleRecordingControls.onStop}
              onUpload={handleRecordingControls.onUpload}
            />

            <div className="text-sm text-muted-foreground">
              {isRecording ? (
                <p>Recording in progress. Click stop when you're finished.</p>
              ) : audioBlob ? (
                <p>
                  Recording complete. Click save to continue or record again.
                </p>
              ) : (
                <p>Click the microphone button to start recording.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="upload-title">Recording Title</Label>
              <Input
                id="upload-title"
                placeholder="Enter a title for your audio file"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-muted-foreground/25 rounded-lg">
              <input
                type="file"
                ref={fileInputRef}
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="mb-2"
              >
                Choose Audio File
              </Button>
              <p className="text-sm text-muted-foreground">
                {uploadedFile ? uploadedFile.name : "No file selected"}
              </p>
            </div>

            {uploadedFile && (
              <WaveformVisualizer audioData={audioData} duration={duration} />
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button
            onClick={handleSave}
            disabled={
              isSaving ||
              (activeTab === "record" && !audioBlob) ||
              (activeTab === "upload" && !uploadedFile)
            }
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecordingModal;
