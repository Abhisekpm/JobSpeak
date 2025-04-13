import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../lib/apiClient';
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { useToast } from "../components/ui/use-toast";
import { Mail, CheckCircle, AlertTriangle } from 'lucide-react';

const RequestPasswordResetPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSubmitted(false);

        try {
            // Call the backend endpoint (ensure URL matches your backend urls.py)
            await apiClient.post('password_reset/', { email });
            
            // Regardless of whether the email exists, show a success message
            setSubmitted(true);
            // Optionally clear the email field
            // setEmail('');

        } catch (err: any) {
            console.error("Password reset request error:", err);
            setError("An error occurred. Please try again."); // Generic error
            toast({
                title: "Request Failed",
                description: "Could not submit password reset request. Please try again later.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-xl">Reset Password</CardTitle>
                    <CardDescription>
                        Enter your email address and we will send you instructions to reset your password.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {submitted ? (
                        <div className="text-center p-4 border rounded-md bg-green-50 border-green-200">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                            <p className="font-medium text-green-800">Request Submitted</p>
                            <p className="text-sm text-green-700 mt-1">
                                If an account with that email exists, you will receive password reset instructions shortly.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            {error && (
                                <p className="text-sm text-red-600 flex items-center gap-1">
                                    <AlertTriangle className="h-4 w-4" /> {error}
                                </p>
                            )}
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Sending...' : 'Send Reset Instructions'}
                            </Button>
                        </form>
                    )}
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Button variant="link" asChild>
                       <Link to="/login">Back to Login</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};

export default RequestPasswordResetPage; 