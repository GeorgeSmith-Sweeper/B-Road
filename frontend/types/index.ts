// API Configuration
export interface AppConfig {
  mapbox_api_key: string;
}

// API Error
export interface ApiError {
  message: string;
  type: 'network' | 'server' | 'timeout' | 'cancelled' | 'unknown';
  status?: number;
  retryable: boolean;
}

// Search Filters
export interface SearchFilters {
  min_curvature: number;
  surface: string;
  limit: number;
}

// Curvature Source (state/region)
export interface SourceInfo {
  id: number;
  name: string;
  segment_count: number;
}

// Curvature Segment Properties (from PostGIS)
export interface CurvatureSegmentProperties {
  id: number;
  id_hash: string;
  name: string;
  curvature: number;
  curvature_level: string;
  length: number;
  length_km: number;
  length_mi: number;
  paved: boolean;
  surface: string;
  source: string;
}

// Curvature Segment Feature
export interface CurvatureSegmentFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: CurvatureSegmentProperties;
}

// Curvature GeoJSON Response
export interface CurvatureGeoJSON {
  type: 'FeatureCollection';
  features: CurvatureSegmentFeature[];
  metadata?: {
    count: number;
  };
}

// Source Bounds
export interface SourceBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

// Curvature Segment Detail (from /curvature/segments/:id)
export interface CurvatureSegmentDetail {
  id: number;
  id_hash: string;
  name: string;
  curvature: number;
  length: number;
  length_km: number;
  length_mi: number;
  paved: boolean;
  source: string;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  } | null;
  ways: Array<Record<string, unknown>>;
}

// EV Station properties (from NREL API via nrel-api.ts)
export interface EVStationProps {
  id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  network?: string | null;
  connectorTypes?: string[] | null;
  level2Count?: number | null;
  dcFastCount?: number | null;
  hours?: string | null;
}

// Chat search filters extracted by Claude
export interface ChatFilters {
  state?: string;
  min_curvature?: number;
  max_curvature?: number;
  surface?: string;
  min_length?: number;
  max_length?: number;
  limit?: number;
  [key: string]: unknown;
}

// Route segment from saved route detail
export interface RouteSegment {
  way_id: number;
  start: [number, number];
  end: [number, number];
  length: number;
  radius: number;
  curvature: number;
  curvature_level: number;
  name?: string | null;
  highway?: string | null;
  surface?: string | null;
}
