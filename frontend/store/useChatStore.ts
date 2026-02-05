import { create } from 'zustand';
import { ChatSearchResult } from '@/lib/chat-api';

interface ChatStore {
  // Chat search results to highlight on map
  searchResults: ChatSearchResult['results'] | null;
  setSearchResults: (results: ChatSearchResult['results'] | null) => void;
  clearSearchResults: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  searchResults: null,
  setSearchResults: (results) => set({ searchResults: results }),
  clearSearchResults: () => set({ searchResults: null }),
}));
