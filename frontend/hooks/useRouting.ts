/**
 * Hook for OSRM route calculation with debouncing.
 */

import { useCallback, useRef } from 'react';
import { useWaypointRouteStore } from '@/store/useWaypointRouteStore';
import { calculateRoute } from '@/lib/routing-api';
import type { Waypoint } from '@/types/routing';

const DEBOUNCE_MS = 150;

export function useRouting() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { setCalculatedRoute, setIsCalculating, setError } = useWaypointRouteStore();

  /**
   * Calculate route between waypoints (immediate, for drag end).
   */
  const recalculateRoute = useCallback(
    async (waypoints: Waypoint[]) => {
      if (waypoints.length < 2) {
        setCalculatedRoute(null);
        return;
      }

      setIsCalculating(true);
      setError(null);

      try {
        const route = await calculateRoute(
          waypoints.map((wp) => ({
            lng: wp.lng,
            lat: wp.lat,
            segment_id: wp.segmentId,
          }))
        );
        setCalculatedRoute(route);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Route calculation failed';
        setError(message);
      }
    },
    [setCalculatedRoute, setIsCalculating, setError]
  );

  /**
   * Preview route during drag (debounced).
   */
  const previewRoute = useCallback(
    (waypoints: Waypoint[]) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        recalculateRoute(waypoints);
      }, DEBOUNCE_MS);
    },
    [recalculateRoute]
  );

  const cancelPreview = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  return { recalculateRoute, previewRoute, cancelPreview };
}
