import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import apiClient from '../../lib/apiClient';

const LoginForm: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, handleSuccessfulAuth } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await login(identifier, password);
    } catch (error) {
      console.error('Standard Login error in component:', error);
      // Error toast is likely handled in AuthContext.login
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLoginSuccess = async (credentialResponse: CredentialResponse) => {
    console.log("Google Login Success credentialResponse:", credentialResponse);
    if (!credentialResponse.credential) {
        console.error("Google Login Success - credentialResponse missing credential");
        alert("Google login failed: No credential received.");
        return;
    }
    setIsLoading(true);
    try {
      // Call the backend endpoint which verifies the Google token
      // and returns our app's JWT tokens (access, refresh)
      // Use relative path here, as apiClient baseURL already includes /api/
      const response = await apiClient.post('auth/google/', { 
        access_token: credentialResponse.credential, 
      });
      
      console.log("Backend Google Auth response:", response.data);
      
      const { access, refresh } = response.data;

      // Pass ONLY the tokens to the refactored handleSuccessfulAuth
      if (access && refresh) {
        await handleSuccessfulAuth(access, refresh); // Let AuthContext handle user fetch & state update
        // Success navigation/toast is handled within handleSuccessfulAuth
      } else {
        console.error("Backend response missing access or refresh tokens.");
        alert("Login failed: Invalid response from server after Google Sign-In.");
        setIsLoading(false); // Ensure loading state is reset on error
      }

    } catch (error) {
      console.error("Error processing Google login with backend:", error);
      alert("Failed to process Google login with backend. Check console for details.");
      setIsLoading(false); // Ensure loading state is reset on error
    } 
    // No finally setIsLoading(false) here, it's handled in success/error paths or by navigation
  };

  const handleGoogleLoginError = () => {
    console.error('Google Login Failed');
    alert("Google login failed. Please try again.");
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-xl">Login to JobSpeak</CardTitle>
        <CardDescription>Enter your credentials to access your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">Email or Username</Label>
            <Input
              id="identifier"
              type="text"
              placeholder="your.email@example.com or username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Log in'}
          </Button>
        </form>
        
        <div className="my-4 flex items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="mx-4 text-xs text-gray-500">OR</span>
            <div className="flex-grow border-t border-gray-300"></div>
        </div>

        <div className="flex justify-center">
             <GoogleLogin
                onSuccess={handleGoogleLoginSuccess}
                onError={handleGoogleLoginError}
                // Optionally disable button while loading
                // disabled={isLoading} 
              />
        </div>

      </CardContent>
      <CardFooter className="flex justify-center">
        <div className="text-center text-sm">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
};

export default LoginForm;
