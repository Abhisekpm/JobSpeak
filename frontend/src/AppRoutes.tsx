import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
// import { AuthProvider } from './contexts/AuthContext'; // Removed import
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/Layout';
import Home from './components/Home';
import ConversationDetail from './components/ConversationDetail';
import SettingsPage from './pages/SettingsPage';
import MockInterviewPage from './pages/MockInterviewPage';
import InterviewDetail from "./components/InterviewDetail";

const AppRoutes: React.FC = () => {
  return (
    // <AuthProvider> // Removed wrapper
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* <Route path="/mock-interview" element={<MockInterviewPage />} /> // Moved back inside */}
        
        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/conversations/:id" element={<ConversationDetail />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/mock-interview" element={<MockInterviewPage />} />
            <Route path="/interviews/:id" element={<InterviewDetail />} />
          </Route>
        </Route>
        
        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    // </AuthProvider> // Removed wrapper
  );
};

export default AppRoutes;
