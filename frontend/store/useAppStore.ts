import { create } from 'zustand';
import { AppMode, Segment, RoadsGeoJSON, SavedRoute, SearchFilters } from '@/types';

interface AppState {
  // Mode
  mode: AppMode;
  setMode: (mode: AppMode) => void;

  // Session
  sessionId: string | null;
  setSessionId: (id: string) => void;

  // Current data
  currentData: RoadsGeoJSON | null;
  setCurrentData: (data: RoadsGeoJSON | null) => void;

  // Route building
  selectedSegments: Segment[];
  addSegment: (segment: Segment) => void;
  removeLastSegment: () => void;
  clearSegments: () => void;

  // Route stats
  routeStats: {
    segmentCount: number;
    totalLength: number;
    totalCurvature: number;
  };
  updateRouteStats: () => void;

  // Saved routes
  savedRoutes: SavedRoute[];
  setSavedRoutes: (routes: SavedRoute[]) => void;

  // Search filters
  searchFilters: SearchFilters;
  setSearchFilters: (filters: Partial<SearchFilters>) => void;

  // Mapbox access token
  mapboxToken: string;
  setMapboxToken: (token: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Mode
  mode: 'browse',
  setMode: (mode) => set({ mode }),

  // Session
  sessionId: null,
  setSessionId: (id) => {
    set({ sessionId: id });
    if (typeof window !== 'undefined') {
      localStorage.setItem('curvature_session_id', id);
    }
  },

  // Current data
  currentData: null,
  setCurrentData: (data) => set({ currentData: data }),

  // Route building
  selectedSegments: [],
  addSegment: (segment) => {
    set((state) => ({
      selectedSegments: [...state.selectedSegments, segment],
    }));
    get().updateRouteStats();
  },
  removeLastSegment: () => {
    set((state) => ({
      selectedSegments: state.selectedSegments.slice(0, -1),
    }));
    get().updateRouteStats();
  },
  clearSegments: () => {
    set({ selectedSegments: [] });
    get().updateRouteStats();
  },

  // Route stats
  routeStats: {
    segmentCount: 0,
    totalLength: 0,
    totalCurvature: 0,
  },
  updateRouteStats: () => {
    const segments = get().selectedSegments;
    set({
      routeStats: {
        segmentCount: segments.length,
        totalLength: segments.reduce((sum, seg) => sum + (seg.length || 0), 0),
        totalCurvature: segments.reduce((sum, seg) => sum + (seg.curvature || 0), 0),
      },
    });
  },

  // Saved routes
  savedRoutes: [],
  setSavedRoutes: (routes) => set({ savedRoutes: routes }),

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
}));
