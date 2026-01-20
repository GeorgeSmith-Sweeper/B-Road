import { create } from 'zustand';
import { RoadsGeoJSON, SearchFilters } from '@/types';

interface AppState {
  // Current data
  currentData: RoadsGeoJSON | null;
  setCurrentData: (data: RoadsGeoJSON | null) => void;

  // Data loaded status
  dataLoaded: boolean;
  setDataLoaded: (loaded: boolean) => void;

  // Search filters
  searchFilters: SearchFilters;
  setSearchFilters: (filters: Partial<SearchFilters>) => void;

  // Mapbox access token
  mapboxToken: string;
  setMapboxToken: (token: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Current data
  currentData: null,
  setCurrentData: (data) => set({ currentData: data }),

  // Data loaded status
  dataLoaded: false,
  setDataLoaded: (loaded) => set({ dataLoaded: loaded }),

  // Search filters
  searchFilters: {
    min_curvature: 300,
    surface: '',
    limit: 100,
  },
  setSearchFilters: (filters) =>
    set((state) => ({
      searchFilters: { ...state.searchFilters, ...filters },
    })),

  // Mapbox token
  mapboxToken: '',
  setMapboxToken: (token) => set({ mapboxToken: token }),
}));
