import axios from 'axios';
import {
  AppConfig,
  RoadsGeoJSON,
  Session,
  SaveRouteRequest,
  SaveRouteResponse,
  SavedRoutesResponse,
  RouteViewResponse,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const apiClient = {
  // Get configuration
  getConfig: async (): Promise<AppConfig> => {
    const response = await api.get<AppConfig>('/config');
    return response.data;
  },

  // Load data from msgpack file
  loadData: async (filepath: string): Promise<{ message: string }> => {
    const response = await api.post('/data/load', null, {
      params: { filepath },
    });
    return response.data;
  },

  // Search roads (browse mode)
  searchRoads: async (
    min_curvature: number,
    surface: string,
    limit: number
  ): Promise<RoadsGeoJSON> => {
    const params: Record<string, string | number> = {
      min_curvature,
      limit,
    };
    if (surface) {
      params.surface = surface;
    }
    const response = await api.get<RoadsGeoJSON>('/roads/geojson', { params });
    return response.data;
  },

  // Load segments (stitch mode)
  loadSegments: async (
    min_curvature: number,
    limit: number = 500
  ): Promise<RoadsGeoJSON> => {
    const response = await api.get<RoadsGeoJSON>('/roads/segments', {
      params: { min_curvature, limit },
    });
    return response.data;
  },

  // Create session
  createSession: async (): Promise<Session> => {
    const response = await api.post<Session>('/sessions/create');
    return response.data;
  },

  // Save route
  saveRoute: async (
    sessionId: string,
    routeData: SaveRouteRequest
  ): Promise<SaveRouteResponse> => {
    const response = await api.post<SaveRouteResponse>(
      '/routes/save',
      routeData,
      {
        params: { session_id: sessionId },
      }
    );
    return response.data;
  },

  // List saved routes
  listRoutes: async (sessionId: string): Promise<SavedRoutesResponse> => {
    const response = await api.get<SavedRoutesResponse>('/routes/list', {
      params: { session_id: sessionId },
    });
    return response.data;
  },

  // View route
  viewRoute: async (urlSlug: string): Promise<RouteViewResponse> => {
    const response = await api.get<RouteViewResponse>(`/routes/${urlSlug}`);
    return response.data;
  },

  // Delete route
  deleteRoute: async (routeId: number, sessionId: string): Promise<void> => {
    await api.delete(`/routes/${routeId}`, {
      params: { session_id: sessionId },
    });
  },

  // Export route
  getExportUrl: (urlSlug: string, format: 'kml' | 'gpx'): string => {
    return `${API_BASE_URL}/routes/${urlSlug}/export/${format}`;
  },
};
