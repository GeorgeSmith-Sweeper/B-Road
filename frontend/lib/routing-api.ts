/**
 * API client for OSRM routing endpoints.
 */

import type { CalculatedRoute, Waypoint } from '@/types/routing';
import { API_BASE_URL, parseErrorResponse } from '@/lib/config';
import { buildStitchPlan, type RouteLeg } from '@/lib/route-stitcher';

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
    const error = await parseErrorResponse(response);
    throw new Error(error.detail || `Route calculation failed: ${response.status}`);
  }

  return response.json();
}

/** Shape of a single gap sent to the backend. */
export interface GapRequestBody {
  gap_index: number;
  waypoints: { lng: number; lat: number }[];
}

/** Shape of a single gap returned by the backend. */
export interface GapResponseBody {
  gap_index: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  distance: number;
  duration: number;
}

/** Full response from POST /routing/calculate-gaps. */
export interface CalculateGapsResponse {
  gaps: GapResponseBody[];
  total_distance: number;
  total_duration: number;
}

/**
 * Route multiple independent gaps via the backend OSRM endpoint.
 */
export async function calculateGaps(
  gaps: GapRequestBody[]
): Promise<CalculateGapsResponse> {
  const response = await fetch(`${API_BASE_URL}/routing/calculate-gaps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gaps }),
  });

  if (!response.ok) {
    const error = await parseErrorResponse(response);
    throw new Error(error.detail || `Gap calculation failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Build OSRM gap requests from the osrm_gap legs of a stitch plan.
 */
function buildGapRequests(legs: RouteLeg[]): GapRequestBody[] {
  const gaps: GapRequestBody[] = [];
  let gapIndex = 0;

  for (const leg of legs) {
    if (leg.type === 'osrm_gap') {
      const waypoints: { lng: number; lat: number }[] = [
        { lng: leg.from[0], lat: leg.from[1] },
      ];
      if (leg.viaWaypoints) {
        for (const via of leg.viaWaypoints) {
          waypoints.push({ lng: via[0], lat: via[1] });
        }
      }
      waypoints.push({ lng: leg.to[0], lat: leg.to[1] });
      gaps.push({ gap_index: gapIndex, waypoints });
      gapIndex++;
    }
  }

  return gaps;
}

/**
 * Stitch segment geometries and OSRM gap geometries into a single
 * GeoJSON LineString coordinate array. Deduplicates boundary points.
 */
function stitchCoordinates(
  legs: RouteLeg[],
  gapGeometries: Map<number, [number, number][]>
): [number, number][] {
  const allCoords: [number, number][] = [];
  let gapIndex = 0;

  for (const leg of legs) {
    let coords: [number, number][];

    if (leg.type === 'segment') {
      coords = leg.coordinates;
    } else {
      coords = gapGeometries.get(gapIndex) ?? [];
      gapIndex++;
    }

    for (let j = 0; j < coords.length; j++) {
      // Skip the first point of this leg if it duplicates the last stitched point
      if (j === 0 && allCoords.length > 0) {
        const last = allCoords[allCoords.length - 1];
        if (last[0] === coords[0][0] && last[1] === coords[0][1]) {
          continue;
        }
      }
      allCoords.push(coords[j]);
    }
  }

  return allCoords;
}

/**
 * Orchestrate the hybrid routing flow:
 * 1. Build a stitch plan from waypoints
 * 2. Call OSRM only for gap legs
 * 3. Stitch everything into one CalculatedRoute
 *
 * Falls back to the classic full-OSRM calculateRoute if the gaps endpoint fails.
 */
export async function calculateHybridRoute(
  waypoints: Waypoint[]
): Promise<CalculatedRoute> {
  const plan = buildStitchPlan(waypoints);

  // No legs means there's nothing to stitch (< 2 waypoints)
  if (plan.legs.length === 0) {
    return {
      geometry: { type: 'LineString', coordinates: [] },
      distance: 0,
      duration: 0,
      waypoints: [],
    };
  }

  const gapRequests = buildGapRequests(plan.legs);
  const gapGeometries = new Map<number, [number, number][]>();
  let gapTotalDistance = 0;
  let gapTotalDuration = 0;

  if (gapRequests.length > 0) {
    try {
      const gapResponse = await calculateGaps(gapRequests);
      for (const gap of gapResponse.gaps) {
        gapGeometries.set(gap.gap_index, gap.geometry.coordinates);
      }
      gapTotalDistance = gapResponse.total_distance;
      gapTotalDuration = gapResponse.total_duration;
    } catch (err) {
      // Fallback: route everything through classic OSRM
      console.warn('calculateGaps failed, falling back to full OSRM route:', err);
      return calculateRoute(
        waypoints.map((wp) => ({ lng: wp.lng, lat: wp.lat, segment_id: wp.segmentId }))
      );
    }
  }

  const coordinates = stitchCoordinates(plan.legs, gapGeometries);

  return {
    geometry: { type: 'LineString', coordinates },
    distance: gapTotalDistance, // segment distances added in Step 7
    duration: gapTotalDuration,
    waypoints: waypoints.map((wp) => ({ lng: wp.lng, lat: wp.lat, snapped: true })),
  };
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
