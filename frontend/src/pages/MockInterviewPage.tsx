import React, { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Loader2 } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const MockInterviewPage: React.FC = () => {
  const [questions, setQuestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log("Fetching mock interview questions...");
        // Use the correct relative path based on apiClient base URL
        const response = await apiClient.get<{ questions: string[] }>('/mock-interview-questions/');
        console.log("Response received:", response.data);
        setQuestions(response.data.questions || []); // Ensure questions is always an array
      } catch (err: any) {
        console.error("Error fetching mock interview questions:", err);
        const errorData = err.response?.data?.error;
        const status = err.response?.status;

        if (status === 400) {
          setError(errorData || "Missing resume or job description. Please upload both in Settings.");
        } else if (status === 503) {
          setError(errorData || "The question generation service is currently unavailable. Please try again later.");
        } else if (status === 404 && errorData?.includes("User profile not found")) {
            setError("User profile not found. Please complete your profile setup in Settings.");
        } else {
          setError(errorData || "An error occurred while fetching questions. Please try again later.");
        }
        setQuestions([]); // Clear any stale questions on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, []); // Empty dependency array means fetch only on mount

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Mock Interview Practice</h1>

      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          <span>Generating your tailored questions...</span>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mb-6">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Generating Questions</AlertTitle>
          <AlertDescription>
            {error}
            {/* Conditionally show link to settings for missing file or profile errors */}
            {(error.toLowerCase().includes("missing required file") || error.toLowerCase().includes("user profile not found")) && (
                 <Button variant="link" asChild className="p-0 h-auto ml-1">
                    <Link to="/settings">Go to Settings</Link>
                 </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && questions.length > 0 && (
        <div className="space-y-4">
           <p className="text-muted-foreground">Here are some questions based on your uploaded resume and job description. Take your time to think through your responses.</p>
          <ul className="list-decimal list-inside space-y-3 pl-4">
            {questions.map((question, index) => (
              <li key={index} className="text-lg">
                {question}
              </li>
            ))}
          </ul>
        </div>
      )}
       
      {!isLoading && !error && questions.length === 0 && (
         <p className="text-muted-foreground text-center py-10">No questions available or generated. Ensure you have uploaded both a resume and job description in Settings.</p> 
      )}
    </div>
  );
};

export default MockInterviewPage;
