// API Configuration
export interface AppConfig {
  mapbox_api_key: string;
}

// GeoJSON Types
export interface RoadProperties {
  name: string;
  curvature: number;
  length_mi: number;
  length_km: number;
  surface: string;
  way_id?: string;
  highway?: string;
  radius?: number;
  curvature_level?: string;
  start?: [number, number];
  end?: [number, number];
  length?: number;
  selected?: boolean;
}

export interface RoadFeature {
  type: 'Feature';
  id?: string;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: RoadProperties;
}

export interface RoadsGeoJSON {
  type: 'FeatureCollection';
  features: RoadFeature[];
}

// Segment for Route Building
export interface Segment {
  id: string;
  way_id: string;
  start: [number, number];
  end: [number, number];
  length: number;
  radius: number;
  curvature: number;
  curvature_level: string;
  name: string;
  highway: string;
  surface: string;
}

// Session
export interface Session {
  session_id: string;
}

// Saved Route
export interface SavedRoute {
  route_id: number;
  route_name: string;
  description?: string;
  url_slug: string;
  segment_count: number;
  total_curvature: number;
  total_length_mi: number;
  created_at: string;
}

export interface SavedRoutesResponse {
  routes: SavedRoute[];
}

// Route Save Request
export interface SaveRouteRequest {
  route_name: string;
  description?: string;
  segments: Segment[];
  is_public: boolean;
}

// Route Save Response
export interface SaveRouteResponse {
  message: string;
  route_id: number;
  url_slug: string;
  share_url: string;
}

// Route View Response
export interface RouteViewResponse {
  route_id: number;
  route_name: string;
  description?: string;
  url_slug: string;
  segment_count: number;
  total_curvature: number;
  total_length_mi: number;
  total_length_km: number;
  created_at: string;
  geojson: RoadsGeoJSON;
}

// UI Mode
export type AppMode = 'browse' | 'stitch';

// Search Filters
export interface SearchFilters {
  min_curvature: number;
  surface: string;
  limit: number;
}
