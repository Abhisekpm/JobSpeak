import React, { useState } from "react";
import ConversationCard from "./ConversationCard";
import SearchFilter from "./SearchFilter";
import { Button } from "./ui/button";
import { Info } from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  date: string;
  duration: string;
  transcriptionPreview: string;
}

interface ConversationGridProps {
  conversations?: Conversation[];
  onConversationClick?: (id: string) => void;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onExport?: (id: string) => void;
}

const ConversationGrid: React.FC<ConversationGridProps> = ({
  conversations = [
    {
      id: "1",
      title: "Team Weekly Standup",
      date: "May 15, 2023",
      duration: "32:45",
      transcriptionPreview:
        "John: I've been working on the new feature. Sarah: Great progress! I think we should focus on...",
    },
    {
      id: "2",
      title: "Client Onboarding Call",
      date: "May 12, 2023",
      duration: "45:12",
      transcriptionPreview:
        "Hi there! Thanks for choosing our service. Let me walk you through the main features...",
    },
    {
      id: "3",
      title: "Product Strategy Meeting",
      date: "May 10, 2023",
      duration: "58:30",
      transcriptionPreview:
        "We need to prioritize the mobile experience. Users are increasingly accessing our platform via smartphones...",
    },
    {
      id: "4",
      title: "Interview with Candidate",
      date: "May 8, 2023",
      duration: "42:15",
      transcriptionPreview:
        "Tell me about your experience with React. I've been working with React for about 3 years now...",
    },
    {
      id: "5",
      title: "Marketing Campaign Review",
      date: "May 5, 2023",
      duration: "28:45",
      transcriptionPreview:
        "The social media campaign performed better than expected. We saw a 25% increase in engagement...",
    },
    {
      id: "6",
      title: "Customer Feedback Session",
      date: "May 3, 2023",
      duration: "35:20",
      transcriptionPreview:
        "I really like the new dashboard, but I think the analytics section could be more intuitive...",
    },
  ],
  onConversationClick = (id) => console.log(`Conversation ${id} clicked`),
  onDelete = (id) => console.log(`Delete conversation ${id}`),
  onShare = (id) => console.log(`Share conversation ${id}`),
  onExport = (id) => console.log(`Export conversation ${id}`),
}) => {
  const [filteredConversations, setFilteredConversations] =
    useState<Conversation[]>(conversations);
  const [searchQuery, setSearchQuery] = useState("");

  // Handle search functionality
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredConversations(conversations);
      return;
    }

    const filtered = conversations.filter(
      (conversation) =>
        conversation.title.toLowerCase().includes(query.toLowerCase()) ||
        conversation.transcriptionPreview
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    setFilteredConversations(filtered);
  };

  // Handle filter functionality
  const handleFilter = (filters: any) => {
    let filtered = [...conversations];

    // Filter by date if date filters are selected
    if (filters.date.length > 0) {
      // This is a simplified example - in a real app, you would implement actual date filtering logic
      console.log("Filtering by dates:", filters.date);
    }

    // Filter by duration if duration filters are selected
    if (filters.duration.length > 0) {
      // This is a simplified example - in a real app, you would implement actual duration filtering logic
      console.log("Filtering by durations:", filters.duration);
    }

    setFilteredConversations(filtered);
  };

  // Handle sort functionality
  const handleSort = (sortOption: string) => {
    let sorted = [...filteredConversations];

    switch (sortOption) {
      case "newest":
        // Sort by date (newest first) - simplified example
        sorted.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        break;
      case "oldest":
        // Sort by date (oldest first) - simplified example
        sorted.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
        break;
      case "longest":
        // Sort by duration (longest first) - simplified example
        sorted.sort((a, b) => {
          const aDuration = a.duration.split(":").map(Number);
          const bDuration = b.duration.split(":").map(Number);
          const aMinutes = aDuration[0] * 60 + (aDuration[1] || 0);
          const bMinutes = bDuration[0] * 60 + (bDuration[1] || 0);
          return bMinutes - aMinutes;
        });
        break;
      case "shortest":
        // Sort by duration (shortest first) - simplified example
        sorted.sort((a, b) => {
          const aDuration = a.duration.split(":").map(Number);
          const bDuration = b.duration.split(":").map(Number);
          const aMinutes = aDuration[0] * 60 + (aDuration[1] || 0);
          const bMinutes = bDuration[0] * 60 + (bDuration[1] || 0);
          return aMinutes - bMinutes;
        });
        break;
      case "alphabetical":
        // Sort alphabetically by title
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      default:
        break;
    }

    setFilteredConversations(sorted);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 bg-gray-50">
      {/* Search and Filter Section */}
      <div className="mb-6">
        <SearchFilter
          onSearchChange={handleSearch}
          onFilter={handleFilter}
        />
      </div>

      {/* Add spacing below the search/filter bar */}
      <div className="h-4"></div>

      {/* Conversations Grid */}
      {filteredConversations.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredConversations.map((conversation) => (
            <ConversationCard
              key={conversation.id}
              id={conversation.id}
              title={conversation.title}
              date={conversation.date}
              duration={conversation.duration}
              transcriptionPreview={conversation.transcriptionPreview}
              onClick={() => onConversationClick(conversation.id)}
              onDelete={() => onDelete(conversation.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg shadow-sm">
          <div className="bg-gray-100 p-4 rounded-full mb-4">
            <Info className="h-8 w-8 text-gray-500" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            No conversations found
          </h3>
          <p className="text-gray-500 text-center max-w-md">
            {searchQuery
              ? `No conversations match "${searchQuery}". Try a different search term or clear filters.`
              : "You don't have any recorded conversations yet. Use the + button to record or upload a conversation."}
          </p>
          {searchQuery && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => handleSearch("")}
            >
              Clear Search
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default ConversationGrid;
