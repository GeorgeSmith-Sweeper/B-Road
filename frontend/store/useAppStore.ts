import { create } from 'zustand';
import { SearchFilters, SourceInfo, CurvatureGeoJSON } from '@/types';

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

  // Curvature segment data (from PostGIS)
  curvatureData: CurvatureGeoJSON | null;
  setCurvatureData: (data: CurvatureGeoJSON | null) => void;

  // Current map viewport for debounced loading
  mapViewport: {
    west: number;
    south: number;
    east: number;
    north: number;
    zoom: number;
  } | null;
  setMapViewport: (viewport: { west: number; south: number; east: number; north: number; zoom: number } | null) => void;

  // Curvature loading state
  curvatureLoading: boolean;
  setCurvatureLoading: (loading: boolean) => void;
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

  // Curvature data
  curvatureData: null,
  setCurvatureData: (data) => set({ curvatureData: data }),

  // Map viewport
  mapViewport: null,
  setMapViewport: (viewport) => set({ mapViewport: viewport }),

  // Curvature loading
  curvatureLoading: false,
  setCurvatureLoading: (loading) => set({ curvatureLoading: loading }),
}));
