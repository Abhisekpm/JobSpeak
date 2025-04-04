import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import Header from "./Header";
import FloatingActionButton from "./FloatingActionButton";
import ConversationCard from "./ConversationCard";
import RecordingModal from "./RecordingModal";

// Define a type for the conversation object for better type safety
interface Conversation {
  id: string;
  title: string;
  date: string; // Or Date object, depending on desired format
  duration: number; // Store duration in seconds
  // Add other relevant fields like audio blob/URL if needed later
}

const Home = () => {
  const navigate = useNavigate();
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  // Use useState to manage the conversations array
  // Initialize state from localStorage or default to empty array
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const savedConversations = localStorage.getItem('conversations');
      return savedConversations ? JSON.parse(savedConversations) : [];
    } catch (error) {
      console.error("Error loading conversations from localStorage:", error);
      return []; // Fallback to empty array on error
    }
  });

  // Effect to save conversations to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('conversations', JSON.stringify(conversations));
    } catch (error) {
      console.error("Error saving conversations to localStorage:", error);
    }
  }, [conversations]);

  const handleSaveRecording = (data: { title: string; audio: Blob; duration: number }) => {
    console.log("Recording saved:", data);

    // Create a new conversation object
    const newConversation: Conversation = {
      id: crypto.randomUUID(), // Generate a simple unique ID
      title: data.title || "Untitled Conversation",
      date: new Date().toLocaleDateString(), // Use current date
      duration: data.duration,
      // Potentially store the audio blob or a URL if you upload it somewhere
    };

    // Update the conversations state by adding the new one
    setConversations((prevConversations) => [newConversation, ...prevConversations]);

    setIsRecordingModalOpen(false); // Close the modal
  };

  // Add handler to update conversation title
  const handleTitleChange = (id: string, newTitle: string) => {
    setConversations((prevConversations) =>
      prevConversations.map((conv) =>
        conv.id === id ? { ...conv, title: newTitle } : conv
      )
    );
    // Optionally: add logic here to persist the title change (e.g., API call)
    console.log(`Title changed for ${id} to: ${newTitle}`);
  };

  // Function to handle deleting a conversation
  const handleDeleteConversation = (id: string) => {
    setConversations((prevConversations) =>
      prevConversations.filter((conv) => conv.id !== id)
    );
    // localStorage update is handled by the useEffect hook
    console.log(`Deleted conversation ${id}`);
  };

  // Function to handle navigation to detail view
  const handleViewDetails = (id: string) => {
    navigate(`/conversation/${id}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header
        userName="Abhishek Suman"
      />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">Recent Conversations</h2>
          {conversations.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <p className="text-gray-500">No conversations yet.</p>
              <p className="text-gray-400 text-sm mt-2">
                Click the record or upload button to start.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {conversations.map((conv) => (
                <ConversationCard
                  key={conv.id}
                  id={conv.id}
                  title={conv.title}
                  date={conv.date}
                  duration={`${Math.floor(conv.duration / 60)}:${(conv.duration % 60).toString().padStart(2, '0')}`}
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
