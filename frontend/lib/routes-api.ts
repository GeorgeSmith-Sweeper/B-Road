/**
 * Routes API client for saving and managing user-built routes.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface SaveRouteRequest {
  route_name: string;
  description?: string;
  segments: Array<{
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
  is_public: boolean;
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
  segments: Array<Record<string, unknown>>;
}

export interface SessionResponse {
  session_id: string;
  created_at: string;
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
  request: SaveRouteRequest
): Promise<SaveRouteResponse> {
  const response = await fetch(`${API_BASE_URL}/routes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionId,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Failed to save route: ${response.status}`);
  }

  return response.json();
}

/**
 * List all saved routes for a session.
 */
export async function listRoutes(
  sessionId: string
): Promise<{ routes: RouteResponse[] }> {
  const response = await fetch(`${API_BASE_URL}/routes`, {
    method: 'GET',
    headers: { 'X-Session-Id': sessionId },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Failed to list routes: ${response.status}`);
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
 * Delete a saved route.
 */
export async function deleteRoute(
  routeId: number,
  sessionId: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/routes/${routeId}`, {
    method: 'DELETE',
    headers: { 'X-Session-Id': sessionId },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Failed to delete route: ${response.status}`);
  }
}
