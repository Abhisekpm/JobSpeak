import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import apiClient from '../lib/apiClient';
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { useToast } from "../components/ui/use-toast";
import { Lock, CheckCircle, AlertTriangle } from 'lucide-react';

const ResetPasswordConfirmPage: React.FC = () => {
    const { token } = useParams<{ token: string }>(); // Get token from URL
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        // Basic check if token exists
        if (!token) {
            setError("Invalid password reset link. Token is missing.");
            toast({ title: "Error", description: "Invalid password reset link.", variant: "destructive" });
        }
    }, [token, toast]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (!token) {
            setError("Password reset token is missing.");
            return;
        }

        setIsLoading(true);

        try {
            await apiClient.post('/api/password_reset/confirm/', {
                token,
                password,
            });
            setSuccess(true);
            toast({ 
                title: "Password Reset Successful", 
                description: "You can now log in with your new password.",
            });
            // Redirect to login after a short delay
            setTimeout(() => navigate('/login'), 3000);

        } catch (err: any) {
            console.error("Password reset confirm error:", err);
            let errorMessage = "An error occurred. Please try again.";
            if (err.response?.data) {
                // Attempt to extract more specific errors from backend response
                const errors = err.response.data;
                if (errors.password) {
                    errorMessage = `Password Error: ${errors.password.join(', ')}`;
                } else if (errors.token) {
                     errorMessage = `Token Error: ${errors.token.join(', ')}`;
                } else if (errors.detail) {
                    errorMessage = errors.detail;
                }
            }
            setError(errorMessage);
            toast({
                title: "Reset Failed",
                description: errorMessage,
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
                    <CardTitle className="text-xl">Set New Password</CardTitle>
                    <CardDescription>
                        Enter and confirm your new password.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {success ? (
                        <div className="text-center p-4 border rounded-md bg-green-50 border-green-200">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                            <p className="font-medium text-green-800">Password Reset Successfully</p>
                            <p className="text-sm text-green-700 mt-1">
                                You will be redirected to the login page shortly.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">New Password</Label>
                                <div className="relative">
                                     <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                <div className="relative">
                                     <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
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
                                disabled={isLoading || !token || success} // Disable if loading, no token, or already succeeded
                            >
                                {isLoading ? 'Setting Password...' : 'Reset Password'}
                            </Button>
                        </form>
                    )}
                </CardContent>
                {!success && (
                     <CardFooter className="flex justify-center">
                        <Button variant="link" asChild>
                           <Link to="/login">Back to Login</Link>
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
};

export default ResetPasswordConfirmPage; 