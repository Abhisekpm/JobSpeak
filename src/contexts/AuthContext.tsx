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
  handleSuccessfulAuth: (user: User, accessToken: string, refreshToken: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in on mount
    const checkAuth = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          // Validate token and get user info
          const response = await apiClient.get('/users/me/');
          setUser(response.data);
          setIsAuthenticated(true);
        }
      } catch (error) {
        // If token is invalid, clear it
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
  const handleSuccessfulAuth = (userData: User, accessToken: string, refreshToken: string) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    setUser(userData);
    setIsAuthenticated(true);
    // Optional: Re-initialize apiClient interceptors if needed immediately
    // apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    console.log("Auth state updated successfully.", userData);
    navigate('/'); // Navigate to home page
  };

  const login = async (identifier: string, password: string) => {
    try {
      const response = await apiClient.post('/token/', { 
        username: identifier, 
        password: password
      });
      const { access, refresh } = response.data;
      
      // Get user info (needed to pass to handleSuccessfulAuth)
      const userResponse = await apiClient.get('/users/me/');
      const userData = userResponse.data;
      
      // Call the common handler
      handleSuccessfulAuth(userData, access, refresh);
      
      // Remove toast here, let handleSuccessfulAuth potentially handle it if needed
      // toast({ title: "Login successful", description: "Welcome back!" });
      
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Login failed",
        description: "Invalid credentials. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      await apiClient.post('/register/', { username, email, password });
      toast({ title: "Registration successful", description: "Please log in." });
      // Don't auto-login here anymore, let user log in manually or via Google
      // await login(email, password);
      navigate('/login'); // Redirect to login after registration
    } catch (error) {
      toast({
        title: "Registration failed",
        description: "Please check your information and try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setIsAuthenticated(false);
    setUser(null);
    navigate('/login');
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
