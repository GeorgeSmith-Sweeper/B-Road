import { create } from 'zustand';
import type { WaypointRouteState, Waypoint, CalculatedRoute } from '@/types/routing';

export const useWaypointRouteStore = create<WaypointRouteState>((set, get) => ({
  waypoints: [],
  calculatedRoute: null,
  isCalculating: false,
  error: null,
  sessionId: typeof window !== 'undefined' ? localStorage.getItem('b-road-session-id') : null,

  addWaypoint: (lng, lat, name?, curvature?) => {
    set((state) => {
      const newWaypoint: Waypoint = {
        id: crypto.randomUUID(),
        lng,
        lat,
        order: state.waypoints.length,
        segmentName: name,
        curvature,
        isUserModified: false,
      };
      return {
        waypoints: [...state.waypoints, newWaypoint],
        error: null,
      };
    });
  },

  updateWaypoint: (id, lng, lat) => {
    set((state) => ({
      waypoints: state.waypoints.map((wp) =>
        wp.id === id ? { ...wp, lng, lat, isUserModified: true } : wp
      ),
    }));
  },

  removeWaypoint: (id) => {
    set((state) => {
      const filtered = state.waypoints.filter((wp) => wp.id !== id);
      const reordered = filtered.map((wp, i) => ({ ...wp, order: i }));
      return { waypoints: reordered };
    });
  },

  clearWaypoints: () =>
    set({
      waypoints: [],
      calculatedRoute: null,
      isCalculating: false,
      error: null,
    }),

  setCalculatedRoute: (route) => set({ calculatedRoute: route, isCalculating: false }),

  setIsCalculating: (calculating) => set({ isCalculating: calculating }),

  setError: (error) => set({ error, isCalculating: false }),

  setSessionId: (id) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('b-road-session-id', id);
    }
    set({ sessionId: id });
  },

  getTotalDistance: () => {
    const route = get().calculatedRoute;
    return route ? route.distance / 1609.34 : 0;
  },

  getTotalDuration: () => {
    const route = get().calculatedRoute;
    return route ? route.duration / 60 : 0;
  },

  getWaypointCount: () => get().waypoints.length,

  getAverageCurvature: () => {
    const withCurvature = get().waypoints.filter((wp) => wp.curvature != null);
    if (withCurvature.length === 0) return 0;
    const sum = withCurvature.reduce((acc, wp) => acc + (wp.curvature ?? 0), 0);
    return sum / withCurvature.length;
  },

  getRoadRating: () => {
    const avg = get().getAverageCurvature();
    if (avg === 0) return '—';
    if (avg < 600) return 'RELAXED';
    if (avg < 1000) return 'SPIRITED';
    if (avg < 2000) return 'ENGAGING';
    if (avg < 5000) return 'TECHNICAL';
    if (avg < 10000) return 'EXPERT';
    return 'LEGENDARY';
  },
}));
