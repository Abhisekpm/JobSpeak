import React, { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, X, Upload, Loader2, FileText, CircleHelp, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import apiClient from '../lib/apiClient'; // Import apiClient
import { toast } from "../components/ui/use-toast"; // Import toast

interface UserProfileData {
  username: string;
  resume: string | null; // URL or null
  job_description: string | null; // URL or null
}

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  // State for file selection (local temporary state)
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);
  
  // State for upload process
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isUploadingJd, setIsUploadingJd] = useState(false);
  const [uploadStatusResume, setUploadStatusResume] = useState<string>("");
  const [uploadStatusJd, setUploadStatusJd] = useState<string>("");

  // State for clearing process
  const [isClearingResume, setIsClearingResume] = useState(false);
  const [isClearingJd, setIsClearingJd] = useState(false);

  // State for current profile data from backend
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [currentResumeUrl, setCurrentResumeUrl] = useState<string | null>(null);
  const [currentJdUrl, setCurrentJdUrl] = useState<string | null>(null);

  // Refs for file inputs
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jdInputRef = useRef<HTMLInputElement>(null);

  const isDarkMode = theme === 'dark';

  // --- Fetch Profile Data --- 
  const fetchProfile = useCallback(async () => {
    console.log("Fetching user profile...");
    setIsProfileLoading(true);
    setProfileError(null);
    try {
      const response = await apiClient.get<UserProfileData>('/profile/');
      console.log("Profile data fetched:", response.data);
      setCurrentResumeUrl(response.data.resume);
      setCurrentJdUrl(response.data.job_description);
    } catch (err: any) {
      console.error("Error fetching profile:", err);
      if (err.response?.status === 404) {
        // Profile likely doesn't exist yet (normal for first visit after signal setup)
        setProfileError("Profile not found. Upload files to create it.");
      } else {
        setProfileError("Failed to load profile data.");
        toast({ // Show error toast for fetch failures
          title: "Error Loading Profile",
          description: err.response?.data?.error || "Could not fetch profile details.",
          variant: "destructive",
        });
      }
      // Ensure URLs are null if fetch fails
      setCurrentResumeUrl(null);
      setCurrentJdUrl(null);
    } finally {
      setIsProfileLoading(false);
    }
  }, []); // Empty dependency array means this runs once on mount

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]); // Run fetchProfile when the component mounts

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

    try {
        // Use PATCH to update the specific field on the user profile
        const response = await apiClient.patch<UserProfileData>('/profile/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        
        console.log(`${fileType} uploaded successfully. Response:`, response.data);
        setStatus("Upload successful!");
        
        // Clear the local file state for the uploaded type
        if (fileType === 'resume') setResumeFile(null); else setJdFile(null);
        
        // Re-fetch profile data to get the updated URL
        await fetchProfile(); 
        
        toast({
            title: `${fileType === 'resume' ? 'Resume' : 'Job Description'} Updated`,
            description: "Your file was uploaded successfully.",
        });

    } catch (error: any) {
        console.error(`Failed to upload ${fileType}:`, error);
        const errorMsg = error.response?.data?.error || error.response?.data?.[fieldName]?.[0] || "Upload failed. Please try again.";
        setStatus(`Upload failed: ${errorMsg}`);
        toast({
            title: `Error Uploading ${fileType === 'resume' ? 'Resume' : 'Job Description'}`,
            description: errorMsg,
            variant: "destructive",
        });
        // Clear the local file state on error too, so user can retry
        if (fileType === 'resume') setResumeFile(null); else setJdFile(null);
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
    // Prevent clicking upload if clearing
    if (ref === resumeInputRef && (isUploadingResume || isClearingResume)) return;
    if (ref === jdInputRef && (isUploadingJd || isClearingJd)) return;
    ref.current?.click();
  };

  // --- Function to Clear/Remove a File --- 
  const handleClearFile = async (fileType: 'resume' | 'jd') => {
    const setIsClearing = fileType === 'resume' ? setIsClearingResume : setIsClearingJd;
    const fieldName = fileType === 'resume' ? 'resume' : 'job_description';
    const friendlyName = fileType === 'resume' ? 'Resume' : 'Job Description';

    setIsClearing(true);
    console.log(`Attempting to clear ${fileType}...`);

    try {
      // Send PATCH request with null for the field to clear it
      const response = await apiClient.patch<UserProfileData>('/profile/', { 
          [fieldName]: null 
      });

      console.log(`${friendlyName} cleared successfully. Response:`, response.data);
      
      // Re-fetch profile data to update the UI
      await fetchProfile(); 
      
      toast({
          title: `${friendlyName} Removed`,
          description: `Your ${fileType} file was removed successfully.`,
      });

    } catch (error: any) {
      console.error(`Failed to clear ${fileType}:`, error);
      const errorMsg = error.response?.data?.error || `Could not remove ${fileType}. Please try again.`;
      toast({
          title: `Error Removing ${friendlyName}`,
          description: errorMsg,
          variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Helper to get filename from URL
  const getFilenameFromUrl = (url: string | null): string => {
    if (!url) return "";
    try {
      const urlParts = new URL(url);
      const pathParts = urlParts.pathname.split('/');
      // Decode URI component to handle spaces etc. in filenames
      return decodeURIComponent(pathParts[pathParts.length - 1] || "");
    } catch (e) {
      console.error("Error parsing URL for filename:", e);
      // Fallback if URL parsing fails (e.g., not a full URL)
      const pathParts = url.split('/');
      return pathParts[pathParts.length - 1] || "";
    }
  };
  
  // Render loading state for profile
  if (isProfileLoading) {
      return <div className="container mx-auto px-4 py-8 text-center">Loading profile...</div>;
  }

  // Keep user check after loading check
  if (!user) {
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
                <Label htmlFor="resume-upload" className={(isUploadingResume || isClearingResume) ? "text-muted-foreground" : "cursor-pointer"}>Resume</Label>
                {/* Combined Loading/Clearing Indicator */}
                {(isUploadingResume || isClearingResume) ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  // Show Clear button only if a file exists and not selecting a new one
                  currentResumeUrl && !resumeFile ? (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-muted-foreground hover:text-destructive" 
                      onClick={() => handleClearFile('resume')}
                      aria-label="Remove Resume"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    // Show Upload icon otherwise
                    <Upload 
                        className={`h-4 w-4 text-muted-foreground ${isUploadingResume ? '' : 'cursor-pointer hover:text-primary'}`} 
                        onClick={() => handleIconClick(resumeInputRef)}
                        aria-label="Upload Resume"
                    />
                  )
                )}
            </div>
            <Input 
                ref={resumeInputRef}
                id="resume-upload" 
                type="file" 
                onChange={(e) => handleFileChange(e, 'resume')} 
                accept=".pdf,.doc,.docx"
                className="hidden"
                disabled={isUploadingResume || isClearingResume} // Disable input while uploading or clearing
            />
            {/* Updated Display status message */}
            <p className={`text-xs mt-1 ${(uploadStatusResume.includes('failed') || isClearingResume) ? 'text-destructive' : 'text-muted-foreground'}`}>
                 {isUploadingResume ? "Uploading..." : isClearingResume ? "Removing..." : resumeFile ? `Selected: ${resumeFile.name}` : currentResumeUrl ? <>Current: <a href={currentResumeUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{getFilenameFromUrl(currentResumeUrl)}</a></> : "No resume uploaded"}
                 {uploadStatusResume && !isUploadingResume && ` (${uploadStatusResume})`}
                 {/* Show profile fetch error if relevant and not uploading/clearing */}
                 {!isUploadingResume && !isClearingResume && profileError && !currentResumeUrl && <span className="text-destructive ml-2">({profileError})</span>}
            </p>
          </div>

          {/* Job Description Upload */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
                 <Label htmlFor="jd-upload" className={(isUploadingJd || isClearingJd) ? "text-muted-foreground" : "cursor-pointer"}>Job Description</Label>
                 {/* Combined Loading/Clearing Indicator */} 
                 {(isUploadingJd || isClearingJd) ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  // Show Clear button only if a file exists and not selecting a new one
                  currentJdUrl && !jdFile ? (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-muted-foreground hover:text-destructive" 
                      onClick={() => handleClearFile('jd')}
                      aria-label="Remove Job Description"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    // Show Upload icon otherwise
                    <Upload 
                        className={`h-4 w-4 text-muted-foreground ${isUploadingJd ? '' : 'cursor-pointer hover:text-primary'}`} 
                        onClick={() => handleIconClick(jdInputRef)}
                        aria-label="Upload Job Description"
                    />
                  )
                )}
            </div>
            <Input 
                ref={jdInputRef}
                id="jd-upload" 
                type="file" 
                onChange={(e) => handleFileChange(e, 'jd')} 
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                disabled={isUploadingJd || isClearingJd} // Disable input while uploading or clearing
            />
            {/* Updated Display status message */}
            <p className={`text-xs mt-1 ${(uploadStatusJd.includes('failed') || isClearingJd) ? 'text-destructive' : 'text-muted-foreground'}`}>
                 {isUploadingJd ? "Uploading..." : isClearingJd ? "Removing..." : jdFile ? `Selected: ${jdFile.name}` : currentJdUrl ? <>Current: <a href={currentJdUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{getFilenameFromUrl(currentJdUrl)}</a></> : "No job description uploaded"}
                 {uploadStatusJd && !isUploadingJd && ` (${uploadStatusJd})`}
                 {/* Show profile fetch error if relevant and not uploading/clearing */}
                 {!isUploadingJd && !isClearingJd && profileError && !currentJdUrl && <span className="text-destructive ml-2">({profileError})</span>}
            </p>
          </div>

        </CardContent>
      </Card>

    </div>
  );
};

export default SettingsPage; 