import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Welcome to JobSpeak{user ? `, ${user.username}` : ''}!</h1>
        <p className="text-gray-500">Practice your interview skills and improve your chances of landing your dream job.</p>
      </div>
      
      {/* Render your existing home content here */}
      <div className="grid gap-6 mt-6">
        {/* Your existing conversation list or other content */}
      </div>
    </div>
  );
};

export default Home;
