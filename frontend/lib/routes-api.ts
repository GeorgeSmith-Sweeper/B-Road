/**
 * Routes API client for saving and managing user-built routes.
 */

import { RouteSegment } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface SaveRouteRequest {
  route_name: string;
  description?: string;
  segments?: Array<{
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
  }>;
  waypoints?: Array<{
    lng: number;
    lat: number;
    order: number;
    segment_id?: string | null;
    is_user_modified?: boolean;
  }>;
  connecting_geometry?: {
    type: string;
    coordinates: [number, number][];
  };
  route_type?: 'segment_list' | 'waypoint';
  is_public: boolean;
  total_distance?: number;  // meters, from OSRM
  total_curvature?: number; // sum of waypoint curvatures
}

export interface SaveRouteResponse {
  status: string;
  route_id: number;
  url_slug: string;
  share_url: string;
}

export interface RouteResponse {
  route_id: number;
  route_name: string;
  description: string | null;
  total_curvature: number;
  total_length_km: number;
  total_length_mi: number;
  segment_count: number;
  url_slug: string;
  created_at: string;
  is_public: boolean;
  route_type: 'segment_list' | 'waypoint';
  road_rating?: string | null;
}

export interface WaypointResponse {
  lng: number;
  lat: number;
  order: number;
  segment_id?: string | null;
  is_user_modified: boolean;
}

export interface RouteDetailResponse extends RouteResponse {
  geojson: {
    type: 'Feature';
    geometry: {
      type: 'LineString';
      coordinates: [number, number][];
    };
    properties: Record<string, unknown>;
  };
  segments: RouteSegment[];
  waypoints?: WaypointResponse[];
  connecting_geometry?: {
    type: string;
    coordinates: [number, number][];
  };
}

export interface SessionResponse {
  session_id: string;
  created_at: string;
}

export interface ClaimRoutesResponse {
  claimed_count: number;
  message: string;
}

/**
 * Build headers with optional session and auth token.
 */
function buildHeaders(
  sessionId?: string,
  token?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionId) {
    headers['X-Session-Id'] = sessionId;
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Create a new anonymous session.
 */
export async function createSession(): Promise<SessionResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Failed to create session: ${response.status}`);
  }

  return response.json();
}

/**
 * Save the current route to the backend.
 */
export async function saveRoute(
  sessionId: string,
  request: SaveRouteRequest,
  token?: string
): Promise<SaveRouteResponse> {
  const response = await fetch(`${API_BASE_URL}/routes`, {
    method: 'POST',
    headers: buildHeaders(sessionId, token),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Failed to save route: ${response.status}`);
  }

  return response.json();
}

/**
 * List routes. If token is provided, returns authenticated user's routes.
 * Otherwise returns session routes.
 */
export async function listRoutes(
  sessionId?: string,
  token?: string
): Promise<{ routes: RouteResponse[] }> {
  const response = await fetch(`${API_BASE_URL}/routes`, {
    method: 'GET',
    headers: buildHeaders(sessionId, token),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Failed to list routes: ${response.status}`);
  }

  return response.json();
}

/**
 * List all public routes (no session required).
 */
export async function listPublicRoutes(
  limit: number = 50,
  offset: number = 0
): Promise<{ routes: RouteResponse[] }> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const response = await fetch(`${API_BASE_URL}/routes/public?${params}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Failed to list public routes: ${response.status}`);
  }

  return response.json();
}

/**
 * Get route detail by ID.
 */
export async function getRoute(routeId: number): Promise<RouteDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/routes/${routeId}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Failed to get route: ${response.status}`);
  }

  return response.json();
}

/**
 * Delete a saved route. Authorized by session or auth token.
 */
export async function deleteRoute(
  routeId: number,
  sessionId?: string,
  token?: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/routes/${routeId}`, {
    method: 'DELETE',
    headers: buildHeaders(sessionId, token),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Failed to delete route: ${response.status}`);
  }
}

/**
 * Claim anonymous session routes for the authenticated user.
 */
export async function claimRoutes(
  sessionId: string,
  token: string
): Promise<ClaimRoutesResponse> {
  const response = await fetch(`${API_BASE_URL}/routes/claim`, {
    method: 'POST',
    headers: buildHeaders(sessionId, token),
    body: JSON.stringify({ session_id: sessionId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Failed to claim routes: ${response.status}`);
  }

  return response.json();
}

/**
 * Get the GPX export URL for a route.
 */
export function getGpxExportUrl(slug: string): string {
  return `${API_BASE_URL}/routes/shared/${slug}/export/gpx`;
}

/**
 * Get the KML export URL for a route.
 */
export function getKmlExportUrl(slug: string): string {
  return `${API_BASE_URL}/routes/shared/${slug}/export/kml`;
}
