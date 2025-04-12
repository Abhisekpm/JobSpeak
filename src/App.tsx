import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/toaster';
import { AuthProvider } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RequestPasswordResetPage from './pages/RequestPasswordResetPage';
import ResetPasswordConfirmPage from './pages/ResetPasswordConfirmPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/Layout';
import Home from './components/home';
import ConversationDetail from './components/ConversationDetail';
import SettingsPage from './pages/SettingsPage';

// Simple ThemeProvider since the original can't be found
const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return <div className="app-theme">{children}</div>;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<RequestPasswordResetPage />} />
          <Route path="/reset-password-confirm/:token" element={<ResetPasswordConfirmPage />} />
          
          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/conversation/:id" element={<ConversationDetail />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
