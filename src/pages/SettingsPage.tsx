import React, { useState, ChangeEvent, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, X, Upload, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);
  
  // Separate loading and status states for each file type
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isUploadingJd, setIsUploadingJd] = useState(false);
  const [uploadStatusResume, setUploadStatusResume] = useState<string>("");
  const [uploadStatusJd, setUploadStatusJd] = useState<string>("");

  // Refs for file inputs
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jdInputRef = useRef<HTMLInputElement>(null);

  const isDarkMode = theme === 'dark';

  if (!user) {
    // Optional: Show a loading state or redirect if user data isn't available yet
    // This might happen briefly on page load before AuthContext initializes
    // Or if the route isn't properly protected
    return (
        <div className="container mx-auto px-4 py-8">
             <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  User data not available. You might need to log in.
                </AlertDescription>
            </Alert>
        </div>
    );
  }

  const handleClose = () => {
    navigate('/');
  };

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  // Function to upload a single file immediately
  const uploadSingleFile = async (file: File, fileType: 'resume' | 'jd') => {
    const setIsUploading = fileType === 'resume' ? setIsUploadingResume : setIsUploadingJd;
    const setStatus = fileType === 'resume' ? setUploadStatusResume : setUploadStatusJd;
    const fieldName = fileType === 'resume' ? 'resume' : 'job_description'; // Field name for FormData

    setIsUploading(true);
    setStatus("Uploading...");
    console.log(`Attempting to upload ${fileType}:`, file.name);

    const formData = new FormData();
    formData.append(fieldName, file);

    // --- TODO: Implement Backend API Call for single file upload --- 
    try {
        // Example: Choose endpoint based on fileType or use a single endpoint
        // const endpoint = fileType === 'resume' ? '/users/me/resume/' : '/users/me/jd/';
        // await apiClient.post(endpoint, formData, {
        //     headers: { 'Content-Type': 'multipart/form-data' },
        // });
        
        // Placeholder delay
        await new Promise(resolve => setTimeout(resolve, 1500)); 
        
        // Simulate success for placeholder
        console.log(`${fileType} uploaded successfully (simulated).`);
        setStatus("Upload successful!");
        // Keep the file state to show the selected name
        // If you want to clear after success: fileType === 'resume' ? setResumeFile(null) : setJdFile(null);

    } catch (error) {
        console.error(`Failed to upload ${fileType}:`, error);
        setStatus(`Upload failed. Please try again.`);
        // Optionally clear the file state on error
        // if (fileType === 'resume') setResumeFile(null); else setJdFile(null);
    } finally {
        setIsUploading(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>, fileType: 'resume' | 'jd') => {
    const file = event.target.files ? event.target.files[0] : null;
    if (file) {
        if (fileType === 'resume') {
            setResumeFile(file);
            setUploadStatusResume(""); // Clear previous status
            uploadSingleFile(file, 'resume'); // Upload immediately
        } else {
            setJdFile(file);
            setUploadStatusJd(""); // Clear previous status
            uploadSingleFile(file, 'jd'); // Upload immediately
        }
        console.log(`Selected ${fileType} file:`, file.name);
    }
    // Reset the input value to allow selecting the same file again if needed
    if (event.target) {
        event.target.value = "";
    }
  };

  const handleIconClick = (ref: React.RefObject<HTMLInputElement>) => {
    // Prevent clicking if already uploading that specific file
    if (ref === resumeInputRef && isUploadingResume) return;
    if (ref === jdInputRef && isUploadingJd) return;
    ref.current?.click();
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close Settings">
            <X className="h-5 w-5" />
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your personal account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Username:</span>
            <span className="text-sm">{user.username}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Email:</span>
            <span className="text-sm">{user.email}</span>
          </div>
          {/* Add more user details here if needed, e.g., Name, ID */}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>App Settings</CardTitle>
          <CardDescription>Configure application preferences.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="dark-mode-toggle" className="flex flex-col space-y-1">
              <span>Dark Mode</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Enable dark theme for the application.
              </span>
            </Label>
            <Switch 
              id="dark-mode-toggle" 
              checked={isDarkMode}
              onCheckedChange={handleThemeChange}
              aria-label="Toggle dark mode"
            />
          </div>
          {/* Placeholder for future settings controls */}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Career Resources</CardTitle>
          <CardDescription>Upload your resume and target job description.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Resume Upload */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
                <Label htmlFor="resume-upload" className={isUploadingResume ? "text-muted-foreground" : "cursor-pointer"}>Resume</Label>
                {isUploadingResume ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                    <Upload 
                        className={`h-4 w-4 text-muted-foreground ${isUploadingResume ? '' : 'cursor-pointer hover:text-primary'}`} 
                        onClick={() => handleIconClick(resumeInputRef)}
                        aria-label="Upload Resume"
                    />
                )}
            </div>
            <Input 
                ref={resumeInputRef}
                id="resume-upload" 
                type="file" 
                onChange={(e) => handleFileChange(e, 'resume')} 
                accept=".pdf,.doc,.docx"
                className="hidden"
                disabled={isUploadingResume} // Disable input while uploading
            />
            {/* Display status message */}
            <p className={`text-xs mt-1 ${uploadStatusResume.includes('failed') ? 'text-destructive' : 'text-muted-foreground'}`}>
                {resumeFile && `Selected: ${resumeFile.name} `}
                {uploadStatusResume || (!resumeFile && "No file selected")}
            </p>
          </div>

          {/* Job Description Upload */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
                <Label htmlFor="jd-upload" className={isUploadingJd ? "text-muted-foreground" : "cursor-pointer"}>Job Description</Label>
                 {isUploadingJd ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                    <Upload 
                        className={`h-4 w-4 text-muted-foreground ${isUploadingJd ? '' : 'cursor-pointer hover:text-primary'}`} 
                        onClick={() => handleIconClick(jdInputRef)}
                        aria-label="Upload Job Description"
                    />
                )}
            </div>
            <Input 
                ref={jdInputRef}
                id="jd-upload" 
                type="file" 
                onChange={(e) => handleFileChange(e, 'jd')} 
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                disabled={isUploadingJd} // Disable input while uploading
            />
            {/* Display status message */}
            <p className={`text-xs mt-1 ${uploadStatusJd.includes('failed') ? 'text-destructive' : 'text-muted-foreground'}`}>
                 {jdFile && `Selected: ${jdFile.name} `}
                 {uploadStatusJd || (!jdFile && "No file selected")}
            </p>
          </div>

        </CardContent>
      </Card>

    </div>
  );
};

export default SettingsPage; 