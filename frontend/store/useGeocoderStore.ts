import { create } from 'zustand';
import type { GeocodingFeature } from '@/lib/geocoding-api';

interface GeocoderState {
  query: string;
  suggestions: GeocodingFeature[];
  selectedResult: GeocodingFeature | null;
  isLoading: boolean;
  isOpen: boolean;

  setQuery: (query: string) => void;
  setSuggestions: (suggestions: GeocodingFeature[]) => void;
  selectResult: (result: GeocodingFeature) => void;
  clearResult: () => void;
  reset: () => void;
  setIsLoading: (loading: boolean) => void;
  setIsOpen: (open: boolean) => void;
}

export const useGeocoderStore = create<GeocoderState>((set) => ({
  query: '',
  suggestions: [],
  selectedResult: null,
  isLoading: false,
  isOpen: false,

  setQuery: (query) => set({ query }),
  setSuggestions: (suggestions) => set({ suggestions, isOpen: suggestions.length > 0 }),
  selectResult: (result) =>
    set({ selectedResult: result, query: result.full_address, suggestions: [], isOpen: false }),
  clearResult: () =>
    set({ selectedResult: null, query: '', suggestions: [], isOpen: false }),
  reset: () =>
    set({ query: '', suggestions: [], selectedResult: null, isLoading: false, isOpen: false }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsOpen: (open) => set({ isOpen: open }),
}));
