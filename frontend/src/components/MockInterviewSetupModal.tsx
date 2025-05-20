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
import { X, Upload, Loader2 } from "lucide-react";
import apiClient from "../lib/apiClient";
import MockInterviewInterface from "./MockInterviewInterface";
import { toast } from "./ui/use-toast";

// Define UserProfileData interface for fetching profile
interface UserProfileData {
  username: string;
  resume: string | null;
  job_description: string | null;
  generated_mock_questions: string[] | null;
}

// Helper to get filename from URL (re-added)
const getFilenameFromUrl = (url: string | null): string => {
  if (!url) return "";
  try {
    const urlParts = new URL(url);
    const pathParts = urlParts.pathname.split('/');
    return decodeURIComponent(pathParts[pathParts.length - 1] || "");
  } catch (e) {
    // Fallback for non-URL strings or if URL parsing fails (e.g. relative paths if ever passed)
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

  // New state variables
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedQuestionsList, setGeneratedQuestionsList] = useState<string[]>([]);
  const [isInterviewActive, setIsInterviewActive] = useState(false); // Changed from isInterviewStarting for clarity

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

  const handleActualStartInterview = async () => {
    setErrorMessage(null);
    setGeneratedQuestionsList([]);

    const finalUseExistingResume = useExistingResume && !resumeFile;
    const finalUseExistingJd = useExistingJd && !jdFile && !jdUrl.trim();

    if (!finalUseExistingResume && !resumeFile) {
      setErrorMessage("Please provide a resume.");
      return;
    }
    if (!jdUrl.trim() && (!finalUseExistingJd && !jdFile)) {
        setErrorMessage("Please upload a JD file or ensure an existing one is used (if not providing a URL).");
        return;
    }
    if (jdUrl.trim() && (jdFile || finalUseExistingJd)) {
      setErrorMessage("Please choose either a JD file OR a JD URL/existing file, not both input methods for JD.");
      return;
    }

    setIsLoading(true);
    let filesWereModifiedInModal = false;
    let questionsToUse: string[] | null = null;

    try {
      // Step 1: Upload Resume if a new one is selected in modal
      if (resumeFile) { // A new file was selected by the user in the modal
        const resumeFormData = new FormData();
        resumeFormData.append('resume', resumeFile);
        console.log("Uploading new resume from modal...");
        await apiClient.patch<UserProfileData>('/profile/', resumeFormData, { headers: { 'Content-Type': 'multipart/form-data' } });
        filesWereModifiedInModal = true;
        toast({ title: "Resume Updated", description: "Your new resume has been saved to your profile." });
      }

      // Step 2: Upload JD File if a new one is selected in modal (and no JD URL is primary for this action)
      if (jdFile && !jdUrl.trim()) { // A new file was selected, and no URL typed
        const jdFormData = new FormData();
        jdFormData.append('job_description', jdFile);
        console.log("Uploading new JD file from modal...");
        await apiClient.patch<UserProfileData>('/profile/', jdFormData, { headers: { 'Content-Type': 'multipart/form-data' } });
        filesWereModifiedInModal = true;
        toast({ title: "Job Description Updated", description: "Your new JD file has been saved to your profile." });
      }
      
      // Step 3: Decide question source
      // If a JD URL is provided, filesWereModifiedInModal might still be false if only resume was existing.
      // The critical part is that the backend will clear generated_mock_questions if resume/JD files are changed via PATCH /profile/.
      // So, if filesWereModifiedInModal is true, a new generation is necessary.
      // If jdUrl is provided, we assume it describes the job, and the UserProfile.job_description should align (user's responsibility for now).
      // The generation will use whatever is on profile.

      if (filesWereModifiedInModal || jdUrl.trim()) {
        // If files were changed, or a JD URL is specified (implying user wants questions for *this specific JD URL context*,
        // even if file on profile is different, relying on backend to use profile files)
        // OR if there's simply no other way to get questions (e.g. no initial files)
        console.log("Files were modified in modal or JD URL provided. Fetching new questions based on current profile state...");
        const response = await apiClient.get<{ questions: string[] }>('/mock-interview-questions/');
        questionsToUse = response.data.questions;
      } else {
        // Files were NOT modified in the modal, and no new JD URL was specified.
        // Check profile for existing questions that should correspond to initialResumeUrl and initialJdUrl.
        console.log("Files not modified in modal, no JD URL. Checking profile for stored questions...");
        try {
          const profileResponse = await apiClient.get<UserProfileData>('/profile/');
          if (profileResponse.data.generated_mock_questions && profileResponse.data.generated_mock_questions.length > 0) {
            console.log("Using stored questions from profile:", profileResponse.data.generated_mock_questions);
            questionsToUse = profileResponse.data.generated_mock_questions;
          } else {
            console.log("No stored questions found on profile, or they are empty. Will fetch new ones based on current profile state.");
            const response = await apiClient.get<{ questions: string[] }>('/mock-interview-questions/');
            questionsToUse = response.data.questions;
          }
        } catch (profileError) {
          console.error("Error fetching profile to check for stored questions:", profileError);
          setErrorMessage("Could not check for existing questions. Attempting to generate new questions based on current profile state.");
          // Fallback to generating new questions
          const response = await apiClient.get<{ questions: string[] }>('/mock-interview-questions/');
          questionsToUse = response.data.questions;
        }
      }

      if (questionsToUse && questionsToUse.length > 0) {
        setGeneratedQuestionsList(questionsToUse);
        setIsInterviewActive(true);
        setErrorMessage(null);
      } else {
        setErrorMessage("Failed to obtain questions. Please ensure your resume and job description are correctly uploaded and try again.");
        toast({ title: "No Questions Available", description: "Could not load or generate mock interview questions.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error starting interview from modal:", error);
      const apiError = error.response?.data?.error || "An error occurred while processing your request.";
      setErrorMessage(`Failed to start interview: ${apiError}`);
      toast({ title: "Error Starting Interview", description: apiError, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleModalClose = () => {
    // Reset state when modal is fully closed or interview ends
    setResumeFile(null);
    setJdFile(null);
    setJdUrl("");
    if (initialResumeUrl) setUseExistingResume(true); else setUseExistingResume(false);
    if (initialJdUrl) setUseExistingJd(true); else setUseExistingJd(false);
    setInitialResumeFilename(getFilenameFromUrl(initialResumeUrl));
    setInitialJdFilename(getFilenameFromUrl(initialJdUrl));
    
    setIsLoading(false);
    setErrorMessage(null);
    setGeneratedQuestionsList([]);
    setIsInterviewActive(false); 
    onClose(); // Call the original onClose prop
  }

  if (isInterviewActive) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl h-[calc(100vh-2rem)] max-h-[90vh] p-0 flex flex-col overflow-hidden">
          {/* Optional: Add a header here if needed, or MockInterviewInterface can have its own close button */}
          <MockInterviewInterface
            questions={generatedQuestionsList}
            onEndInterview={() => {
              // When interview ends from within the interface, reset and close modal
              handleModalClose();
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Original modal form for setup
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        handleModalClose(); // Ensure full reset if closed via overlay click or X button
      }
      // Don't call onClose directly here, handleModalClose will do it
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
                Job Description (File or URL)
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
        {errorMessage && (
          <p className="text-sm text-red-500 text-center mt-2 mb-2 px-2 break-words">{errorMessage}</p>
        )}
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t sm:border-t-0 mt-2 sm:mt-0">
          <Button type="button" variant="outline" onClick={handleModalClose} className="w-full sm:w-auto" disabled={isLoading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleActualStartInterview} className="w-full sm:w-auto" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoading ? "Processing..." : "Start Interview"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MockInterviewSetupModal; 