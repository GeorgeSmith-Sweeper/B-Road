import axios from 'axios';
import {
  AppConfig,
  CurvatureGeoJSON,
  SourceInfo,
  SourceBounds,
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

  // Curvature API methods

  // Get curvature segments by bounding box
  getCurvatureSegments: async (
    bbox: string,
    minCurvature: number = 300,
    limit: number = 1000,
    source?: string
  ): Promise<CurvatureGeoJSON> => {
    const params: Record<string, string | number> = {
      bbox,
      min_curvature: minCurvature,
      limit,
    };
    if (source) {
      params.source = source;
    }
    const response = await api.get<CurvatureGeoJSON>('/curvature/segments', {
      params,
    });
    return response.data;
  },

  // List available curvature data sources (states)
  listCurvatureSources: async (): Promise<SourceInfo[]> => {
    const response = await api.get<SourceInfo[]>('/curvature/sources');
    return response.data;
  },

  // Get segments for a specific source
  getCurvatureSourceSegments: async (
    sourceName: string,
    minCurvature: number = 300,
    limit: number = 1000
  ): Promise<CurvatureGeoJSON> => {
    const response = await api.get<CurvatureGeoJSON>(
      `/curvature/sources/${sourceName}/segments`,
      {
        params: { min_curvature: minCurvature, limit },
      }
    );
    return response.data;
  },

  // Get bounds for a source
  getCurvatureSourceBounds: async (sourceName: string): Promise<SourceBounds> => {
    const response = await api.get<SourceBounds>(
      `/curvature/sources/${sourceName}/bounds`
    );
    return response.data;
  },

  // Get detail for a single segment
  getCurvatureSegmentDetail: async (segmentId: number): Promise<unknown> => {
    const response = await api.get(`/curvature/segments/${segmentId}`);
    return response.data;
  },
};
