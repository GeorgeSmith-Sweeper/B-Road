import { create } from 'zustand';
import { SearchFilters, SourceInfo, ApiError } from '@/types';

interface AppState {
  // Search filters
  searchFilters: SearchFilters;
  setSearchFilters: (filters: Partial<SearchFilters>) => void;

  // Mapbox access token
  mapboxToken: string;
  setMapboxToken: (token: string) => void;

  // Curvature data sources (states)
  curvatureSources: SourceInfo[];
  setCurvatureSources: (sources: SourceInfo[]) => void;

  // Selected source for filtering
  selectedSource: string | null;
  setSelectedSource: (source: string | null) => void;

  // Error states
  sourcesError: ApiError | null;
  setSourcesError: (error: ApiError | null) => void;
  initError: ApiError | null;
  setInitError: (error: ApiError | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Search filters
  searchFilters: {
    min_curvature: 300,
    surface: 'paved',
    limit: 100,
  },
  setSearchFilters: (filters) =>
    set((state) => ({
      searchFilters: { ...state.searchFilters, ...filters },
    })),

  // Mapbox token
  mapboxToken: '',
  setMapboxToken: (token) => set({ mapboxToken: token }),

  // Curvature sources
  curvatureSources: [],
  setCurvatureSources: (sources) => set({ curvatureSources: sources }),

  // Selected source
  selectedSource: null,
  setSelectedSource: (source) => set({ selectedSource: source }),

  // Error states
  sourcesError: null,
  setSourcesError: (error) => set({ sourcesError: error }),
  initError: null,
  setInitError: (error) => set({ initError: error }),
}));
