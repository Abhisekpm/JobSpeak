import React, { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { X } from "lucide-react";

// Helper to get filename from URL (similar to SettingsPage)
const getFilenameFromUrl = (url: string | null): string => {
  if (!url) return "";
  try {
    const urlParts = new URL(url);
    const pathParts = urlParts.pathname.split('/');
    return decodeURIComponent(pathParts[pathParts.length - 1] || "");
  } catch (e) {
    const pathParts = url.split('/');
    return pathParts[pathParts.length - 1] || "";
  }
};

interface MockInterviewSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartInterview: (resumeFile: File | null, jdFile: File | null, jdUrl: string, useExistingResume: boolean, useExistingJd: boolean) => void;
  initialResumeUrl?: string | null;
  initialJdUrl?: string | null;
}

const MockInterviewSetupModal: React.FC<MockInterviewSetupModalProps> = ({
  isOpen,
  onClose,
  onStartInterview,
  initialResumeUrl,
  initialJdUrl,
}) => {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [jdUrl, setJdUrl] = useState<string>("");

  // State to track if we should use the initial (profile) files
  const [useExistingResume, setUseExistingResume] = useState(!!initialResumeUrl);
  const [useExistingJd, setUseExistingJd] = useState(!!initialJdUrl && !jdUrl); // Only if no URL typed

  // Display names for initial files
  const [initialResumeFilename, setInitialResumeFilename] = useState("");
  const [initialJdFilename, setInitialJdFilename] = useState("");

  useEffect(() => {
    if (initialResumeUrl) {
      setInitialResumeFilename(getFilenameFromUrl(initialResumeUrl));
      setUseExistingResume(true);
    } else {
      setInitialResumeFilename("");
      setUseExistingResume(false);
    }
  }, [initialResumeUrl]);

  useEffect(() => {
    if (initialJdUrl) {
      setInitialJdFilename(getFilenameFromUrl(initialJdUrl));
      // If a JD URL is also typed, it takes precedence over existing file
      if (!jdUrl) {
         setUseExistingJd(true);
      }
    } else {
      setInitialJdFilename("");
      setUseExistingJd(false);
    }
  }, [initialJdUrl, jdUrl]);

  const handleResumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setResumeFile(event.target.files[0]);
      setUseExistingResume(false); // User selected a new file
    } else { // If user cancels file selection, and there was an initial file, revert to it
      setResumeFile(null);
      if (initialResumeUrl) setUseExistingResume(true);
    }
  };

  const clearResume = () => {
    setResumeFile(null);
    setInitialResumeFilename(""); // Clear display name
    setUseExistingResume(false);
    // Also clear the input field visually if possible (tricky with controlled file inputs)
    const resumeInput = document.getElementById('resume-file') as HTMLInputElement;
    if (resumeInput) resumeInput.value = "";
  }

  const handleJdFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setJdFile(event.target.files[0]);
      setJdUrl(""); // Clear URL if file is selected
      setUseExistingJd(false); // User selected a new file
    } else {
      setJdFile(null);
      if (initialJdUrl && !jdUrl) setUseExistingJd(true);
    }
  };
  
  const clearJdFile = () => {
    setJdFile(null);
    setInitialJdFilename(""); // Clear the display name completely
    setUseExistingJd(false); // Stop using the existing JD file
    
    // Clear the file input if it exists
    const jdInput = document.getElementById('jd-file') as HTMLInputElement;
    if (jdInput) jdInput.value = "";
    
    // Also enable the URL input by ensuring jdUrl is empty if we're not already typing a URL
    if (!jdUrl) {
      // If no URL is being entered, make sure the URL field is enabled
      const jdUrlInput = document.getElementById('jd-url') as HTMLInputElement;
      if (jdUrlInput) jdUrlInput.disabled = false;
    }
    
    console.log("JD file cleared", { useExistingJd: false, jdFile: null });
  }

  const handleJdUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = event.target.value;
    setJdUrl(newUrl);
    setJdFile(null); // Clear file if URL is entered
    // If URL is cleared, and there was an initial JD file, revert to using it
    if (!newUrl.trim() && initialJdUrl) {
      setUseExistingJd(true);
    } else {
      setUseExistingJd(false); // Typing a URL means don't use existing JD file
    }
  };

  const handleSubmit = () => {
    const finalUseExistingResume = useExistingResume && !resumeFile;
    const finalUseExistingJd = useExistingJd && !jdFile && !jdUrl.trim();

    if (!finalUseExistingResume && !resumeFile) {
      alert("Please upload or select a resume.");
      return;
    }
    if (!finalUseExistingJd && !jdFile && !jdUrl.trim()) {
      alert("Please upload or select a job description file or provide a URL.");
      return;
    }
    onStartInterview(resumeFile, jdFile, jdUrl.trim(), finalUseExistingResume, finalUseExistingJd);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        // Reset state on close if desired, or parent can manage this by changing key
        setResumeFile(null);
        setJdFile(null);
        setJdUrl("");
        if (initialResumeUrl) setUseExistingResume(true); else setUseExistingResume(false);
        if (initialJdUrl) setUseExistingJd(true); else setUseExistingJd(false);
      }
      onClose();
    }}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-full p-4 sm:max-w-md md:max-w-lg lg:max-w-[500px] mx-auto sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-center break-words">Practice Mock Interview</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground text-center break-words">
            Upload your resume and the job description to get started.
            Your saved documents from Settings will be used if available.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Label htmlFor="resume-file" className="text-left font-medium">
            Resume
          </Label>
          {(useExistingResume && initialResumeFilename && !resumeFile) ? (
            <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50 overflow-hidden">
              <div className="flex-grow min-w-0 mr-2">
                <p className="text-sm text-foreground truncate" title={initialResumeFilename}>
                  {initialResumeFilename}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={clearResume} title="Use a different resume" className="flex-shrink-0 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5 mr-1" /> Change
              </Button>
            </div>
          ) : (
            <Input
              id="resume-file"
              type="file"
              onChange={handleResumeChange}
              accept=".pdf,.doc,.docx"
            />
          )}
          {resumeFile && (
            <p className="text-xs text-muted-foreground">Selected: {resumeFile.name}</p>
          )}

          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Job Description
              </span>
            </div>
          </div>

          <Label htmlFor="jd-file" className="text-left font-medium">
            Upload JD File
          </Label>
          {(useExistingJd && initialJdFilename && !jdFile && !jdUrl) ? (
             <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50 overflow-hidden">
              <div className="flex-grow min-w-0 mr-2">
                <p className="text-sm text-foreground truncate" title={initialJdFilename}>
                  {initialJdFilename}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={clearJdFile} title="Use a different JD file" className="flex-shrink-0 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5 mr-1" /> Change
              </Button>
            </div>
          ) : (
            <Input
              id="jd-file"
              type="file"
              onChange={handleJdFileChange}
              accept=".pdf,.doc,.docx"
              disabled={!!jdUrl}
            />
          )}
          {jdFile && (
            <p className="text-xs text-muted-foreground">Selected: {jdFile.name}</p>
          )}

          <div className="text-center my-1 text-xs text-muted-foreground">OR</div>

          <Label htmlFor="jd-url" className="text-left font-medium">
            Paste JD URL
          </Label>
          <Input
            id="jd-url"
            placeholder="https://example.com/job-posting"
            value={jdUrl}
            onChange={handleJdUrlChange}
            disabled={!!jdFile || (useExistingJd && !!initialJdFilename)}
          />
        </div>
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t sm:border-t-0 mt-2 sm:mt-0">
          <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
          <Button type="submit" onClick={handleSubmit} className="w-full sm:w-auto">Start Interview</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MockInterviewSetupModal; 