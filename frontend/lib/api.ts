import axios, { AxiosError, CancelTokenSource } from 'axios';
import {
  AppConfig,
  CurvatureGeoJSON,
  SourceInfo,
  SourceBounds,
  ApiError,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

function createApiError(error: unknown): ApiError {
  if (axios.isCancel(error)) {
    return {
      message: 'Request was cancelled',
      type: 'cancelled',
      retryable: false,
    };
  }

  if (error instanceof AxiosError) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return {
        message: 'Request timed out. Please try again.',
        type: 'timeout',
        retryable: true,
      };
    }

    if (!error.response) {
      return {
        message: 'Unable to connect to server. Please check your connection.',
        type: 'network',
        retryable: true,
      };
    }

    const status = error.response.status;
    if (status >= 500) {
      return {
        message: error.response.data?.detail || 'Server error. Please try again later.',
        type: 'server',
        status,
        retryable: true,
      };
    }

    return {
      message: error.response.data?.detail || `Request failed (${status})`,
      type: 'server',
      status,
      retryable: status >= 500,
    };
  }

  return {
    message: 'An unexpected error occurred',
    type: 'unknown',
    retryable: false,
  };
}

export function createCancelToken(): CancelTokenSource {
  return axios.CancelToken.source();
}

export const apiClient = {
  // Get configuration
  getConfig: async (): Promise<AppConfig> => {
    try {
      const response = await api.get<AppConfig>('/config');
      return response.data;
    } catch (error) {
      throw createApiError(error);
    }
  },

  // Curvature API methods

  // Get curvature segments by bounding box
  getCurvatureSegments: async (
    bbox: string,
    minCurvature: number = 300,
    limit: number = 1000,
    source?: string,
    cancelToken?: CancelTokenSource
  ): Promise<CurvatureGeoJSON> => {
    const params: Record<string, string | number> = {
      bbox,
      min_curvature: minCurvature,
      limit,
    };
    if (source) {
      params.source = source;
    }
    try {
      const response = await api.get<CurvatureGeoJSON>('/curvature/segments', {
        params,
        cancelToken: cancelToken?.token,
      });
      return response.data;
    } catch (error) {
      throw createApiError(error);
    }
  },

  // List available curvature data sources (states)
  listCurvatureSources: async (): Promise<SourceInfo[]> => {
    try {
      const response = await api.get<SourceInfo[]>('/curvature/sources');
      return response.data;
    } catch (error) {
      throw createApiError(error);
    }
  },

  // Get segments for a specific source
  getCurvatureSourceSegments: async (
    sourceName: string,
    minCurvature: number = 300,
    limit: number = 1000
  ): Promise<CurvatureGeoJSON> => {
    try {
      const response = await api.get<CurvatureGeoJSON>(
        `/curvature/sources/${sourceName}/segments`,
        {
          params: { min_curvature: minCurvature, limit },
        }
      );
      return response.data;
    } catch (error) {
      throw createApiError(error);
    }
  },

  // Get bounds for a source
  getCurvatureSourceBounds: async (sourceName: string): Promise<SourceBounds> => {
    try {
      const response = await api.get<SourceBounds>(
        `/curvature/sources/${sourceName}/bounds`
      );
      return response.data;
    } catch (error) {
      throw createApiError(error);
    }
  },

  // Get detail for a single segment
  getCurvatureSegmentDetail: async (segmentId: number): Promise<unknown> => {
    try {
      const response = await api.get(`/curvature/segments/${segmentId}`);
      return response.data;
    } catch (error) {
      throw createApiError(error);
    }
  },
};
