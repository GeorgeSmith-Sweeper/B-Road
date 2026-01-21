// API Configuration
export interface AppConfig {
  mapbox_api_key: string;
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
