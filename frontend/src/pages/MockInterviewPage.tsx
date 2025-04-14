import React, { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react';
import apiClient from '../lib/apiClient';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Loader2, Upload, FileText, CircleHelp, Trash2 } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "../components/ui/use-toast";

interface UserProfileData {
  username: string;
  resume: string | null;
  job_description: string | null;
}

const MockInterviewPage: React.FC = () => {
  const [questions, setQuestions] = useState<string[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [hasAttemptedGeneration, setHasAttemptedGeneration] = useState(false);

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isUploadingJd, setIsUploadingJd] = useState(false);
  const [isClearingResume, setIsClearingResume] = useState(false);
  const [isClearingJd, setIsClearingJd] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [currentResumeUrl, setCurrentResumeUrl] = useState<string | null>(null);
  const [currentJdUrl, setCurrentJdUrl] = useState<string | null>(null);

  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jdInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async () => {
    console.log("Fetching user profile for mock interview page...");
    setIsProfileLoading(true);
    setProfileError(null);
    setCurrentResumeUrl(null);
    setCurrentJdUrl(null);
    try {
      const response = await apiClient.get<UserProfileData>('/profile/');
      console.log("Profile data fetched:", response.data);
      setCurrentResumeUrl(response.data.resume);
      setCurrentJdUrl(response.data.job_description);
    } catch (err: any) {
      console.error("Error fetching profile:", err);
      let errorMsg = "Failed to load profile data.";
      if (err.response?.status === 404) {
        errorMsg = "Profile not found. Please upload files.";
      }
      setProfileError(errorMsg);
      toast({ title: "Error Loading Profile", description: errorMsg, variant: "destructive" });
      setCurrentResumeUrl(null);
      setCurrentJdUrl(null);
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const fetchQuestions = useCallback(async () => {
    if (!currentResumeUrl || !currentJdUrl) {
        console.log("Cannot fetch questions: Missing resume or JD URL.");
        setQuestionError("Missing resume or job description. Please upload both files above.");
        setQuestions([]);
        setIsLoadingQuestions(false);
        setHasAttemptedGeneration(true);
        return;
    }

    console.log("Fetching mock interview questions via button...");
    setIsLoadingQuestions(true);
    setQuestionError(null);
    setHasAttemptedGeneration(true);
    try {
      const response = await apiClient.get<{ questions: string[] }>('/mock-interview-questions/');
      console.log("Questions Response received:", response.data);
      setQuestions(response.data.questions || []);
    } catch (err: any) {
      console.error("Error fetching mock interview questions:", err);
      const errorData = err.response?.data?.error;
      const status = err.response?.status;
      let errorMsg = errorData || "An error occurred while fetching questions. Please try again later.";

      if (status === 400 && errorData?.includes("Missing required file")) {
         errorMsg = "Missing resume or job description on server. Please re-upload files.";
      } else if (status === 503) {
        errorMsg = errorData || "The question generation service is currently unavailable. Please try again later.";
      } else if (status === 404 && errorData?.includes("User profile not found")) {
        errorMsg = "User profile error on server. Cannot fetch questions.";
      } else if (status === 400 && errorData?.includes("Failed to process files")) {
        errorMsg = "Error processing uploaded files. Please try uploading again.";
      }

      setQuestionError(errorMsg);
      setQuestions([]);
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [currentResumeUrl, currentJdUrl]);

  const uploadSingleFile = async (file: File, fileType: 'resume' | 'jd') => {
    const setIsUploading = fileType === 'resume' ? setIsUploadingResume : setIsUploadingJd;
    const fieldName = fileType === 'resume' ? 'resume' : 'job_description';

    setIsUploading(true);
    setQuestionError(null);
    setHasAttemptedGeneration(false);
    setQuestions([]);
    console.log(`Attempting to upload ${fileType}:`, file.name);
    const formData = new FormData();
    formData.append(fieldName, file);

    try {
      await apiClient.patch<UserProfileData>('/profile/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log(`${fileType} uploaded successfully.`);
      toast({ title: `${fileType === 'resume' ? 'Resume' : 'Job Description'} Updated`, description: "File uploaded successfully." });
      if (fileType === 'resume') setResumeFile(null); else setJdFile(null);
      await fetchProfile();

    } catch (error: any) {
      console.error(`Failed to upload ${fileType}:`, error);
      const errorMsg = error.response?.data?.error || error.response?.data?.[fieldName]?.[0] || "Upload failed. Please try again.";
      toast({ title: `Error Uploading ${fileType === 'resume' ? 'Resume' : 'Job Description'}`, description: errorMsg, variant: "destructive" });
      if (fileType === 'resume') setResumeFile(null); else setJdFile(null);
      await fetchProfile();
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>, fileType: 'resume' | 'jd') => {
    const file = event.target.files ? event.target.files[0] : null;
    if (file) {
      if (fileType === 'resume') {
        setResumeFile(file);
        uploadSingleFile(file, 'resume');
      } else {
        setJdFile(file);
        uploadSingleFile(file, 'jd');
      }
      console.log(`Selected ${fileType} file:`, file.name);
    }
    if (event.target) event.target.value = "";
  };

  const handleIconClick = (ref: React.RefObject<HTMLInputElement>) => {
    if (ref === resumeInputRef && (isUploadingResume || isClearingResume)) return;
    if (ref === jdInputRef && (isUploadingJd || isClearingJd)) return;
    ref.current?.click();
  };

  const handleClearFile = async (fileType: 'resume' | 'jd') => {
    const setIsClearing = fileType === 'resume' ? setIsClearingResume : setIsClearingJd;
    const fieldName = fileType === 'resume' ? 'resume' : 'job_description';
    const friendlyName = fileType === 'resume' ? 'Resume' : 'Job Description';

    setIsClearing(true);
    setQuestionError(null);
    setHasAttemptedGeneration(false);
    setQuestions([]);
    console.log(`Attempting to clear ${fileType}...`);
    try {
      await apiClient.patch<UserProfileData>('/profile/', { [fieldName]: null });
      console.log(`${friendlyName} cleared successfully.`);
      toast({ title: `${friendlyName} Removed`, description: `File removed successfully.` });
      await fetchProfile();

    } catch (error: any) {
      console.error(`Failed to clear ${fileType}:`, error);
      const errorMsg = error.response?.data?.error || `Could not remove ${fileType}.`;
      toast({ title: `Error Removing ${friendlyName}`, description: errorMsg, variant: "destructive" });
       await fetchProfile();
    } finally {
      setIsClearing(false);
    }
  };

  const getFilenameFromUrl = (url: string | null): string => {
    if (!url) return "";
    try {
      const path = new URL(url).pathname;
      const parts = path.split('/');
      return decodeURIComponent(parts[parts.length - 1] || "");
    } catch (e) {
        const parts = url.split('/');
        return parts[parts.length - 1] || "";
    }
  };

  const handleGenerateClick = () => {
      fetchQuestions();
  };

  const isGenerateDisabled = isLoadingQuestions || isProfileLoading || !currentResumeUrl || !currentJdUrl;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Card>
        <CardHeader>
            </CardHeader>
        <CardContent className="space-y-4">
           {isProfileLoading && (
             <div className="flex items-center text-sm text-muted-foreground">
               <Loader2 className="mr-2 h-4 w-4 animate-spin" />
               Loading profile data...
             </div>
           )}
           {!isProfileLoading && profileError && !currentResumeUrl && !currentJdUrl && (
             <Alert variant="destructive" className="text-sm">
                 <CircleHelp className="h-4 w-4" />
                 <AlertTitle>Profile Error</AlertTitle>
                 <AlertDescription>{profileError}</AlertDescription>
             </Alert>
           )}
          {!isProfileLoading && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                  <Label htmlFor="resume-upload" className={(isUploadingResume || isClearingResume) ? "text-muted-foreground" : "cursor-pointer"}>Resume</Label>
                  {(isUploadingResume || isClearingResume) ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    currentResumeUrl && !resumeFile ? (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleClearFile('resume')} aria-label="Remove Resume">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Upload className={`h-4 w-4 text-muted-foreground ${isUploadingResume ? '' : 'cursor-pointer hover:text-primary'}`} onClick={() => handleIconClick(resumeInputRef)} aria-label="Upload Resume" />
                    )
                  )}
              </div>
              <Input ref={resumeInputRef} id="resume-upload" type="file" onChange={(e) => handleFileChange(e, 'resume')} accept=".pdf,.doc,.docx" className="hidden" disabled={isUploadingResume || isClearingResume} />
              <p className={`text-xs mt-1 ${isClearingResume ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {isUploadingResume ? "Uploading..." : isClearingResume ? "Removing..." : resumeFile ? `Selected: ${resumeFile.name}` : currentResumeUrl ? <>Current: <a href={currentResumeUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{getFilenameFromUrl(currentResumeUrl)}</a></> : "No resume uploaded"}
              </p>
            </div>
          )}

          {!isProfileLoading && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                  <Label htmlFor="jd-upload" className={(isUploadingJd || isClearingJd) ? "text-muted-foreground" : "cursor-pointer"}>Job Description</Label>
                  {(isUploadingJd || isClearingJd) ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    currentJdUrl && !jdFile ? (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleClearFile('jd')} aria-label="Remove Job Description">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Upload className={`h-4 w-4 text-muted-foreground ${isUploadingJd ? '' : 'cursor-pointer hover:text-primary'}`} onClick={() => handleIconClick(jdInputRef)} aria-label="Upload Job Description" />
                    )
                  )}
              </div>
              <Input ref={jdInputRef} id="jd-upload" type="file" onChange={(e) => handleFileChange(e, 'jd')} accept=".pdf,.doc,.docx,.txt" className="hidden" disabled={isUploadingJd || isClearingJd} />
              <p className={`text-xs mt-1 ${isClearingJd ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {isUploadingJd ? "Uploading..." : isClearingJd ? "Removing..." : jdFile ? `Selected: ${jdFile.name}` : currentJdUrl ? <>Current: <a href={currentJdUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{getFilenameFromUrl(currentJdUrl)}</a></> : "No job description uploaded"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {!isProfileLoading && (
            <div className="flex justify-center mt-4">
                <Button
                    onClick={handleGenerateClick}
                    disabled={isGenerateDisabled}
                >
                    {isLoadingQuestions ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {isLoadingQuestions ? 'Generating...' : 'Generate Mock Interview Questions'}
                </Button>
            </div>
        )}

      <div className="mt-6">
          {hasAttemptedGeneration && (
             <h2 className="text-xl font-semibold tracking-tight mb-4">Generated Questions</h2>
          )}

          {isLoadingQuestions && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span>Generating...</span>
            </div>
          )}

          {hasAttemptedGeneration && questionError && !isLoadingQuestions && (
            <Alert variant="destructive" className="mb-6">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Could Not Generate Questions</AlertTitle>
              <AlertDescription>
                {questionError}
              </AlertDescription>
            </Alert>
          )}

          {hasAttemptedGeneration && !isLoadingQuestions && !questionError && questions.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Here are some questions based on your uploaded resume and job description. Have a friend conduct the mock interview and record your response for getting coaching feedback.</p>
              <ul className="list-decimal list-inside space-y-3 pl-4">
                {questions.map((question, index) => (
                  <li key={index} className="text-lg">
                    {question}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasAttemptedGeneration && !isLoadingQuestions && !questionError && questions.length === 0 && (
             <p className="text-muted-foreground text-center py-6">No questions generated. Please check your uploaded files or try again.</p>
          )}

           {!hasAttemptedGeneration && !isProfileLoading && (
             <p className="text-muted-foreground text-center py-6">Upload a resume and a target job description, then click the button above to generate questions.</p>
           )}
      </div>

    </div>
  );
};

export default MockInterviewPage;
