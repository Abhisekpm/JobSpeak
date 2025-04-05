import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import apiClient from "../lib/apiClient"; // Import the API client
import Header from "./Header";
import FloatingActionButton from "./FloatingActionButton";
import ConversationCard from "./ConversationCard";
import RecordingModal from "./RecordingModal";
import { Button } from "./ui/button"; // Added for error display

// Define a type for the conversation object matching the backend model/serializer
interface Conversation {
  id: number; // Django typically uses numbers for IDs
  name: string;
  created_at: string; // DRF DateTimeField usually serializes to ISO 8601 string
  updated_at: string;
  status: string;
  // We can add derived/formatted fields if needed, but let's format inline for now
  // date?: string;
  // duration?: number;
}

const Home = () => {
  const navigate = useNavigate();
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Effect to fetch conversations from the API on component mount
  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<Conversation[]>('/conversations/');
        // Set state directly with backend data
        setConversations(response.data);
      } catch (err: any) {
        console.error("Error fetching conversations:", err);
        setError("Failed to load conversations. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, []); // Empty dependency array means this runs once on mount

  // --- Handlers (TODO: Update to use API calls) --- 
  const handleSaveRecording = (data: { title: string; audio: Blob; duration: number }) => {
    console.log("Recording saved (Local):", data);
    const newConversation: any = {
      id: crypto.randomUUID(),
      name: data.title || "Untitled Conversation",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'new',
      // Simulating required fields for local display before API integration
      date: new Date().toLocaleDateString(), // Add formatted date for immediate display
      duration: data.duration // Add duration for immediate display
    };
    // Prepending to list for immediate feedback
    setConversations((prevConversations) => [newConversation, ...prevConversations]); 
    setIsRecordingModalOpen(false);
  };

  const handleTitleChange = (id: string | number, newTitle: string) => {
    setConversations((prevConversations) =>
      prevConversations.map((conv) =>
        conv.id === id ? { ...conv, name: newTitle } : conv
      )
    );
    console.log(`Title changed for ${id} to: ${newTitle} (Local)`);
  };

  const handleDeleteConversation = (id: string | number) => {
    setConversations((prevConversations) =>
      prevConversations.filter((conv) => conv.id !== id)
    );
    console.log(`Deleted conversation ${id} (Local)`);
  };

  const handleViewDetails = (id: string | number) => {
    navigate(`/conversation/${String(id)}`);
  };

  // Helper function to format date (can be moved to utils if needed)
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return "Invalid Date";
    }
  };

  // --- Render Logic --- 

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header userName="Abhishek Suman" />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">Recent Conversations</h2>

          {/* Loading State */} 
          {isLoading && (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading conversations...</p>
            </div>
          )}

          {/* Error State */} 
          {error && (
            <div className="text-center py-12 border border-dashed border-red-400 rounded-lg bg-red-50 p-4">
              <p className="text-red-600 font-medium">Error loading conversations</p>
              <p className="text-red-500 text-sm mt-2">{error}</p>
              <Button 
                variant="outline" 
                size="sm"
                className="mt-4"
                onClick={() => window.location.reload()} // Simple refresh retry
              >
                Retry
              </Button>
            </div>
          )}

          {/* Empty State */} 
          {!isLoading && !error && conversations.length === 0 && (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <p className="text-gray-500">No conversations yet.</p>
              <p className="text-gray-400 text-sm mt-2">
                Click the button below to start recording or uploading.
              </p>
            </div>
          )}

          {/* Data Display */} 
          {!isLoading && !error && conversations.length > 0 && (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {conversations.map((conv) => (
                <ConversationCard
                  key={conv.id}
                  id={String(conv.id)}
                  title={conv.name}
                  date={formatDate(conv.created_at)} // Format created_at for display
                  duration={"--:--"} // Use placeholder since duration isn't available yet
                  onClick={() => handleViewDetails(conv.id)}
                  onDelete={() => handleDeleteConversation(conv.id)}
                  onTitleChange={handleTitleChange}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <FloatingActionButton onFabClick={() => setIsRecordingModalOpen(true)} />
      <RecordingModal
        isOpen={isRecordingModalOpen}
        onClose={() => setIsRecordingModalOpen(false)}
        onSave={handleSaveRecording}
      />
    </div>
  );
};

export default Home;
