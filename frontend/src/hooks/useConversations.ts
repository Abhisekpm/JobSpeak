import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';

export interface Conversation {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  status: string;
  audio_file: string | null;
  duration: number | null;
  status_transcription: string;
  status_transcription_display: string;
  transcription_text: unknown | null;
  status_recap: string;
  status_recap_display: string;
  recap_text: string | null;
  status_summary: string;
  status_summary_display: string;
  summary_data: {
    short: string | null;
    balanced: string | null;
    detailed: string | null;
  } | null;
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  const fetchConversations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("Fetching conversations...");
      const response = await apiClient.get<Conversation[]>("/conversations/");
      const now = new Date();
      setLastFetchTime(now);
      
      let fetchedConversations: Conversation[] = [];
      if (Array.isArray(response.data)) {
        fetchedConversations = response.data;
      } else if (response.data && Array.isArray((response.data as any).results)) {
        fetchedConversations = (response.data as any).results;
      } else {
        console.error("Unexpected response data format for conversations:", response.data);
        setError("Failed to load conversations due to unexpected data format.");
        return;
      }
      
      console.log(`Fetched ${fetchedConversations.length} conversations at ${now.toISOString()}`);
      
      // Log summary data availability for each conversation
      fetchedConversations.forEach(conv => {
        console.log(`Conversation ${conv.id} data:`, {
          name: conv.name,
          status_transcription: conv.status_transcription,
          status_summary: conv.status_summary,
          has_summary_data: !!conv.summary_data,
          short_summary: conv.summary_data?.short?.substring(0, 30) + (conv.summary_data?.short && conv.summary_data.short.length > 30 ? '...' : '')
        });
      });
      
      setConversations(fetchedConversations);
    } catch (err: any) {
      console.error("Error fetching conversations:", err);
      setError(err.message || "Failed to load conversations");
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const refreshConversations = () => {
    fetchConversations();
  };
  
  const fetchSingleConversation = async (id: number) => {
    try {
      console.log(`Fetching single conversation ${id}...`);
      const response = await apiClient.get<Conversation>(`/conversations/${id}/`);
      
      // Log the response specifically focusing on summary data
      const conversation = response.data;
      console.log(`Fetched conversation ${id} details:`, {
        status_transcription: conversation.status_transcription,
        status_summary: conversation.status_summary,
        has_summary_data: !!conversation.summary_data,
        summary_data: conversation.summary_data
      });
      
      // Update the conversation in the local state
      setConversations(prev => prev.map(conv => 
        conv.id === id ? conversation : conv
      ));
      
      return conversation;
    } catch (err) {
      console.error(`Error fetching conversation ${id}:`, err);
      return null;
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  return {
    conversations,
    isLoading,
    error,
    refreshConversations,
    fetchSingleConversation,
    lastFetchTime
  };
}

export default useConversations; 