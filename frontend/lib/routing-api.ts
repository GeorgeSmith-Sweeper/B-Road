/**
 * API client for OSRM routing endpoints.
 */

import type { CalculatedRoute, CurvyRouteOptions, CurvyRouteResult } from '@/types/routing';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface RoutingWaypoint {
  lng: number;
  lat: number;
  segment_id?: string;
}

/**
 * Calculate a route between waypoints via the road network.
 */
export async function calculateRoute(
  waypoints: RoutingWaypoint[]
): Promise<CalculatedRoute> {
  const response = await fetch(`${API_BASE_URL}/routing/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ waypoints }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Route calculation failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Find a curvy route between two points, maximizing time on twisty roads.
 */
export async function findCurvyRoute(request: {
  start: { lng: number; lat: number };
  end: { lng: number; lat: number };
  options?: Partial<CurvyRouteOptions>;
}): Promise<CurvyRouteResult> {
  const response = await fetch(`${API_BASE_URL}/routing/curvy-route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Curvy route calculation failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Check OSRM routing engine health.
 */
export async function checkRoutingHealth(): Promise<{
  osrm_available: boolean;
  osrm_version: string | null;
}> {
  const response = await fetch(`${API_BASE_URL}/routing/health`);

  if (!response.ok) {
    return { osrm_available: false, osrm_version: null };
  }

  return response.json();
}
