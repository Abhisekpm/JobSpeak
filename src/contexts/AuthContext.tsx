import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../lib/apiClient';
import { useToast } from '../components/ui/use-toast';

interface User {
  id: number;
  username: string;
  email: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  handleSuccessfulAuth: (accessToken: string, refreshToken: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          // Make sure the apiClient uses the token from storage for this initial check
          console.log("[Initial Check] Attempting to fetch user data...");
          const response = await apiClient.get('/users/me/');
          console.log("[Initial Check] User data fetched successfully:", response.data);
          setUser(response.data);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.log("[Initial Check] Failed or no token:", error);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // --- Function to handle setting auth state after successful login/auth --- 
  const handleSuccessfulAuth = async (accessToken: string, refreshToken: string) => {
    console.log("[handleSuccessfulAuth] Received tokens.");
    
    // 1. Store tokens first
    console.log("[handleSuccessfulAuth] Storing access token:", accessToken);
    localStorage.setItem('access_token', accessToken);
    console.log("[handleSuccessfulAuth] Storing refresh token:", refreshToken);
    localStorage.setItem('refresh_token', refreshToken);
    console.log("[handleSuccessfulAuth] Tokens stored in localStorage.");
    
    try {
        // 2. Fetch user data
        console.log("[handleSuccessfulAuth] Attempting to fetch user data with new token...");
        const userResponse = await apiClient.get('/users/me/');
        const userData = userResponse.data;
        console.log("[handleSuccessfulAuth] User data fetched successfully:", userData);

        // 3. Set state
        console.log("[handleSuccessfulAuth] Setting user state and isAuthenticated=true.");
        setUser(userData);
        setIsAuthenticated(true);
        console.log("Auth state updated successfully.");
        navigate('/'); 
        
    } catch (error) {
        console.error("[handleSuccessfulAuth] Failed to fetch user data after storing tokens:", error);
        toast({
            title: "Authentication Error",
            description: "Could not retrieve user details. Logging out.",
            variant: "destructive",
        });
        logout(); 
        throw error; 
    }
  };

  const login = async (identifier: string, password: string) => {
    try {
      console.log(`[Login] Attempting login for user: ${identifier}`);
      const response = await apiClient.post('/token/', { 
        username: identifier, 
        password: password
      });
      const { access, refresh } = response.data;
      console.log("[Login] Received tokens from /token/ endpoint.");
      
      await handleSuccessfulAuth(access, refresh);
      console.log("[Login] handleSuccessfulAuth completed.");
      
    } catch (error) {
      if (error.response?.status !== 401) {
         console.error("[Login] Error during /token/ call:", error);
         toast({
           title: "Login failed",
           description: "Invalid credentials or server error. Please try again.",
           variant: "destructive",
         });
      } else {
         console.log("[Login] Caught 401 during user fetch, handled in handleSuccessfulAuth.");
      }
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      console.log(`[Register] Attempting registration for: ${username}`);
      await apiClient.post('/register/', { username, email, password });
      console.log("[Register] Registration successful.");
      toast({ title: "Registration successful", description: "Please log in." });
      navigate('/login'); 
    } catch (error) {
      console.error("[Register] Registration failed:", error);
      toast({
        title: "Registration failed",
        description: error.response?.data?.detail || "Please check your information and try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const logout = () => {
    console.log("[Logout] Clearing tokens and user state.");
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setIsAuthenticated(false);
    setUser(null);
    navigate('/login');
    console.log("User logged out.");
  };

  const value = {
    isAuthenticated,
    user,
    loading,
    login,
    register,
    logout,
    handleSuccessfulAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
