import { create } from 'zustand';
import type { WaypointRouteState, Waypoint, CalculatedRoute } from '@/types/routing';

export const useWaypointRouteStore = create<WaypointRouteState>((set, get) => ({
  waypoints: [],
  calculatedRoute: null,
  isCalculating: false,
  error: null,
  highlightedSegmentIds: [],

  addWaypointsFromSegment: (segmentId, segmentName, startCoord, endCoord) => {
    set((state) => {
      // Don't add duplicate segments
      if (state.highlightedSegmentIds.includes(segmentId)) {
        return state;
      }

      const currentLen = state.waypoints.length;
      const newWaypoints: Waypoint[] = [
        {
          id: crypto.randomUUID(),
          lng: startCoord[0],
          lat: startCoord[1],
          order: currentLen,
          segmentId,
          segmentName: segmentName || undefined,
          isUserModified: false,
        },
        {
          id: crypto.randomUUID(),
          lng: endCoord[0],
          lat: endCoord[1],
          order: currentLen + 1,
          segmentId,
          segmentName: segmentName || undefined,
          isUserModified: false,
        },
      ];

      return {
        waypoints: [...state.waypoints, ...newWaypoints],
        highlightedSegmentIds: [...state.highlightedSegmentIds, segmentId],
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
      // Reorder
      const reordered = filtered.map((wp, i) => ({ ...wp, order: i }));
      // Recalculate highlighted segments (remove if no waypoints reference it)
      const remainingSegIds = new Set(reordered.map((wp) => wp.segmentId).filter(Boolean));
      return {
        waypoints: reordered,
        highlightedSegmentIds: state.highlightedSegmentIds.filter((id) => remainingSegIds.has(id)),
      };
    });
  },

  clearWaypoints: () =>
    set({
      waypoints: [],
      calculatedRoute: null,
      isCalculating: false,
      error: null,
      highlightedSegmentIds: [],
    }),

  setCalculatedRoute: (route) => set({ calculatedRoute: route, isCalculating: false }),

  setIsCalculating: (calculating) => set({ isCalculating: calculating }),

  setError: (error) => set({ error, isCalculating: false }),

  getTotalDistance: () => {
    const route = get().calculatedRoute;
    return route ? route.distance / 1609.34 : 0;
  },

  getTotalDuration: () => {
    const route = get().calculatedRoute;
    return route ? route.duration / 60 : 0;
  },

  getWaypointCount: () => get().waypoints.length,
}));
