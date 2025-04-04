import React, { useEffect, useRef, useState } from "react";
import { Card } from "./ui/card";
import { Mic, Pause, Play } from "lucide-react";

interface WaveformVisualizerProps {
  audioData?: number[];
  isRecording?: boolean;
  isPaused?: boolean;
  duration?: number;
  onPlayPause?: () => void;
}

const WaveformVisualizer = ({
  audioData = Array(50)
    .fill(0)
    .map(() => Math.random() * 100),
  isRecording = false,
  isPaused = false,
  duration = 0,
  onPlayPause = () => {},
}: WaveformVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [animationId, setAnimationId] = useState<number | null>(null);

  // Format duration in MM:SS format
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Draw waveform on canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Always clear the canvas when this effect runs
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Only draw if currently recording
    if (isRecording) {
      // Set waveform style for recording
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ef4444"; // Red for recording

      // Draw waveform function (now only called when isRecording is true)
      const drawWaveform = () => {
        // Clear canvas for the new frame (important for animation)
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = canvas.width / audioData.length;
        const centerY = canvas.height / 2;

        ctx.beginPath();
        ctx.moveTo(0, centerY);

        for (let i = 0; i < audioData.length; i++) {
          const x = i * barWidth;
          const amplitude = (audioData[i] / 100) * (canvas.height / 2);
          // Use live simulation logic
          const y = centerY + Math.sin(Date.now() * 0.001 + i) * amplitude;
          ctx.lineTo(x, y);
        }

        ctx.stroke();

        // Continue animation only if recording and not paused
        if (isRecording && !isPaused) {
          const id = requestAnimationFrame(drawWaveform);
          setAnimationId(id); // Store the id to cancel later
        } else {
           setAnimationId(null); // Clear animation ID if paused or stopped
        }
      };

      // Start the drawing loop
      drawWaveform();

    } else {
      // If not recording, ensure no animation ID is stored
      setAnimationId(null);
    }

    // Cleanup function: cancel any pending animation frame using the state variable
    return () => {
      // Retrieve the current value from state for cleanup
      setAnimationId(currentAnimationId => {
        if (currentAnimationId) {
          cancelAnimationFrame(currentAnimationId);
        }
        return null; // Ensure state is cleared after cleanup
      });
    };
  // Dependencies: Run when data or recording state changes. Removed animationId.
  }, [audioData, isRecording, isPaused]);

  return (
    <Card className="w-full p-6 bg-background border-border">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            {isRecording ? (
              <div className="flex items-center">
                <Mic className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-sm font-medium text-red-500 animate-pulse">
                  {isPaused ? "Recording paused" : "Recording..."}
                </span>
              </div>
            ) : (
              null
            )}
          </div>
          <div className="text-sm font-mono">{formatDuration(duration)}</div>
        </div>

        {/* Only render the waveform container and canvas if currently recording */}
        {isRecording && (
          <div className={`relative h-24 w-full rounded-md overflow-hidden bg-muted/20`}>
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          </div>
        )}
      </div>
    </Card>
  );
};

export default WaveformVisualizer;
