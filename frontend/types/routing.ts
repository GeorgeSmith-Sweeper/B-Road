/**
 * TypeScript types for OSRM waypoint routing and curvy route finding.
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
  /** Anonymous session ID for saving routes */
  sessionId: string | null;

  // Actions
  addWaypoint: (lng: number, lat: number, name?: string) => void;
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
}

/** Tuning parameters for the curvy route algorithm. */
export interface CurvyRouteOptions {
  corridor_width: number; // meters (1000-50000)
  min_curvature: number; // 300-5000
  min_segment_length: number; // meters
  max_waypoints: number; // 5-25
  max_detour_ratio: number; // 1.1-5.0
}

export interface CurvySegmentInfo {
  id: number;
  name: string | null;
  curvature: number;
  length: number;
  score: number;
}

export interface CurvyRouteResult {
  geometry: RouteGeometry;
  distance: number; // meters
  duration: number; // seconds
  baseline_distance: number; // meters
  baseline_duration: number; // seconds
  detour_ratio: number;
  curvy_segments: CurvySegmentInfo[];
  total_curvature_score: number;
  waypoints_used: number;
  corridor_width: number;
  generated_waypoints: { lng: number; lat: number }[];
}
