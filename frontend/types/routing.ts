/**
 * TypeScript types for OSRM waypoint routing.
 */

export interface Waypoint {
  id: string;
  lng: number;
  lat: number;
  order: number;
  segmentId?: string;
  segmentName?: string;
  isUserModified: boolean;
}

export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface CalculatedRoute {
  geometry: RouteGeometry;
  distance: number; // meters
  duration: number; // seconds
  waypoints: { lng: number; lat: number; snapped: boolean }[];
}

export interface WaypointRouteState {
  // State
  waypoints: Waypoint[];
  calculatedRoute: CalculatedRoute | null;
  isCalculating: boolean;
  error: string | null;
  /** IDs of segments that have been added (for highlight) */
  highlightedSegmentIds: string[];

  // Actions
  addWaypointsFromSegment: (
    segmentId: string,
    segmentName: string | null,
    startCoord: [number, number],
    endCoord: [number, number],
  ) => void;
  updateWaypoint: (id: string, lng: number, lat: number) => void;
  removeWaypoint: (id: string) => void;
  clearWaypoints: () => void;
  setCalculatedRoute: (route: CalculatedRoute | null) => void;
  setIsCalculating: (calculating: boolean) => void;
  setError: (error: string | null) => void;

  // Computed
  getTotalDistance: () => number; // miles
  getTotalDuration: () => number; // minutes
  getWaypointCount: () => number;
}
