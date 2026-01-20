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
}

export interface RoadFeature {
  type: 'Feature';
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

// Search Filters
export interface SearchFilters {
  min_curvature: number;
  surface: string;
  limit: number;
}
