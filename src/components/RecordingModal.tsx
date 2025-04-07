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

  const timerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timer for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setDuration((prevDuration) => prevDuration + 1);
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

  // --- Format Duration --- 
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-[525px] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{activeTab === "record" ? "Record New Conversation" : "Upload Audio File"}</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "record" | "upload")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-none">
            <TabsTrigger value="record" className="rounded-none">Record</TabsTrigger>
            <TabsTrigger value="upload" className="rounded-none">Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="record" className="p-6 flex flex-col items-center">
            <div className="w-full mb-4">
              <Label htmlFor="recording-title">Title (Optional)</Label>
              <Input 
                id="recording-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter conversation title..."
                className="mt-1"
              />
            </div>

            <div className="h-20 w-full flex items-center justify-center bg-gray-100 rounded-md mb-4">
              {isRecording && !isPaused ? (
                <div className="flex items-end justify-center h-10 gap-2 animate-wave">
                  <span className="w-2 h-full bg-black"></span>
                  <span className="w-2 h-full bg-black"></span>
                  <span className="w-2 h-full bg-black"></span>
                  <span className="w-2 h-full bg-black"></span>
                  <span className="w-2 h-full bg-black"></span>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  { isPaused ? "Recording Paused" : "Press record to start"}
                </p>
              )}
            </div>
            
            <div className="text-lg font-mono mb-4 min-w-[5ch] text-center">
              {formatDuration(duration)}
            </div>
            <RecordingControls 
              onRecord={handleRecordingControls.onRecord}
              onPause={handleRecordingControls.onPause}
              onStop={handleRecordingControls.onStop}
              isRecording={isRecording}
              isPaused={isPaused}
            />
          </TabsContent>

          <TabsContent value="upload" className="p-6 flex flex-col items-center">
            <div className="w-full mb-4">
              <Label htmlFor="upload-title">Title (Optional)</Label>
              <Input 
                id="upload-title"
                value={title} 
                onChange={(e) => setTitle(e.target.value)}
                placeholder={uploadedFile ? "Using file name" : "Enter conversation title..."}
                className="mt-1"
                disabled={!!uploadedFile}
              />
            </div>

            <div className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center mb-4 h-40 text-center">
               {uploadedFile ? (
                  <div>
                    <p className="text-sm font-medium">Selected: {uploadedFile.name}</p>
                    <p className="text-xs text-gray-500">{formatDuration(duration)}</p> 
                  </div>
               ) : (
                  <p className="text-sm text-gray-500">Drag & drop audio file here, or click to select</p>
               )}
              <Input 
                ref={fileInputRef}
                type="file" 
                accept="audio/*" 
                onChange={handleFileUpload} 
                className="hidden" 
                id="audio-upload" 
              />
              {!uploadedFile && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => fileInputRef.current?.click()}>
                      Select File
                  </Button>
              )}
              {uploadedFile && (
                 <Button variant="outline" size="sm" className="mt-4" onClick={() => { setUploadedFile(null); setDuration(0); if(fileInputRef.current) fileInputRef.current.value=""; }}>
                      Clear Selection
                 </Button>
              )}
            </div>
          </TabsContent>

        </Tabs>
        
        <DialogFooter className="p-6 pt-0">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isSaving}
           >Cancel</Button>
          <Button 
            onClick={handleSave} 
            disabled={!audioBlob && !uploadedFile || isSaving}
          >
            {isSaving ? "Saving..." : "Save Conversation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecordingModal;
