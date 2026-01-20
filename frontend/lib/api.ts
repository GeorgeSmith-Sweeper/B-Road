import axios from 'axios';
import { AppConfig, RoadsGeoJSON } from '@/types';

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

  // Search roads
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
};
