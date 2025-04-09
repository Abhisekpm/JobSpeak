import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';

const Header: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 py-4">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <Link to="/" className="font-bold text-xl">JobSpeak</Link>
        <div>
          {isAuthenticated ? (
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">{user?.username}</span>
              <Button variant="outline" onClick={logout}>Logout</Button>
            </div>
          ) : (
            <Link to="/login" className="text-blue-600 hover:underline">Login</Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
