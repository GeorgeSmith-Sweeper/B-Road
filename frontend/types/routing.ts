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
  curvature?: number;
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
  /** Anonymous session ID for saving routes */
  sessionId: string | null;

  // Actions
  addWaypoint: (lng: number, lat: number, name?: string, curvature?: number) => void;
  updateWaypoint: (id: string, lng: number, lat: number) => void;
  removeWaypoint: (id: string) => void;
  clearWaypoints: () => void;
  setCalculatedRoute: (route: CalculatedRoute | null) => void;
  setIsCalculating: (calculating: boolean) => void;
  setError: (error: string | null) => void;
  setSessionId: (id: string) => void;

  // Computed
  getTotalDistance: () => number; // miles
  getTotalDuration: () => number; // minutes
  getWaypointCount: () => number;
  getAverageCurvature: () => number;
  getRoadRating: () => string;
}

