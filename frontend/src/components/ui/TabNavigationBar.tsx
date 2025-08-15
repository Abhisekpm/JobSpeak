import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Assuming this is the correct path for shadcn/ui tabs

interface TabNavigationBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void; // Keep for compatibility, but will use navigate instead
}

const TabNavigationBar: React.FC<TabNavigationBarProps> = ({ activeTab, setActiveTab }) => {
  const navigate = useNavigate();

  const handleTabChange = (newTab: string) => {
    // Navigate to the appropriate URL based on the tab
    if (newTab === 'conversations') {
      navigate('/conversations');
    } else if (newTab === 'mock-interviews') {
      navigate('/interviews');
    }
    // setActiveTab is no longer needed since URL change will trigger state update in Home
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full sticky top-16 z-40 bg-background shadow-sm">
      {/* Adjusted top to top-16 (64px) assuming header is h-16 (64px) and sticky top-0 z-50.
          Adjust this value based on the actual height of your MainHeader.
      */}
      <TabsList className="grid w-full grid-cols-2 rounded-none">
        <TabsTrigger value="conversations" className="rounded-none">
          Career Conversations
        </TabsTrigger>
        <TabsTrigger value="mock-interviews" className="rounded-none">
          Mock Interviews
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};

export default TabNavigationBar; 