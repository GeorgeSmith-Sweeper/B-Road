import { create } from 'zustand';

export interface RouteSegmentData {
  way_id: number;
  name: string | null;
  curvature: number;
  length: number; // meters
  start: [number, number]; // [lat, lon]
  end: [number, number]; // [lat, lon]
  radius: number;
  curvature_level: number;
  highway: string | null;
  surface: string | null;
  // GeoJSON coordinates for rendering on map
  coordinates: [number, number][]; // [lon, lat][] from the feature geometry
}

interface RouteStore {
  // State
  routeSegments: RouteSegmentData[];
  isBuilding: boolean;
  sessionId: string | null;

  // Actions
  addSegment: (segment: RouteSegmentData) => boolean;
  removeSegment: (index: number) => void;
  moveSegment: (fromIndex: number, toIndex: number) => void;
  clearRoute: () => void;
  setBuilding: (building: boolean) => void;
  setSessionId: (id: string) => void;
  loadSegments: (segments: RouteSegmentData[]) => void;

  // Derived (computed via get)
  getTotalDistance: () => number; // miles
  getTotalCurvature: () => number;
  getSegmentCount: () => number;
}

export const useRouteStore = create<RouteStore>((set, get) => ({
  routeSegments: [],
  isBuilding: true,
  sessionId: typeof window !== 'undefined' ? localStorage.getItem('b-road-session-id') : null,

  addSegment: (segment) => {
    const { routeSegments } = get();
    // Reject duplicates by way_id
    if (routeSegments.some((s) => s.way_id === segment.way_id)) {
      return false;
    }
    set({ routeSegments: [...routeSegments, segment] });
    return true;
  },

  removeSegment: (index) => {
    set((state) => ({
      routeSegments: state.routeSegments.filter((_, i) => i !== index),
    }));
  },

  moveSegment: (fromIndex, toIndex) => {
    set((state) => {
      const segments = [...state.routeSegments];
      const [moved] = segments.splice(fromIndex, 1);
      segments.splice(toIndex, 0, moved);
      return { routeSegments: segments };
    });
  },

  clearRoute: () => set({ routeSegments: [] }),

  setBuilding: (building) => set({ isBuilding: building }),

  setSessionId: (id) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('b-road-session-id', id);
    }
    set({ sessionId: id });
  },

  loadSegments: (segments) => set({ routeSegments: segments }),

  getTotalDistance: () => {
    const { routeSegments } = get();
    const totalMeters = routeSegments.reduce((sum, s) => sum + s.length, 0);
    return totalMeters / 1609.34;
  },

  getTotalCurvature: () => {
    const { routeSegments } = get();
    return routeSegments.reduce((sum, s) => sum + s.curvature, 0);
  },

  getSegmentCount: () => get().routeSegments.length,
}));
