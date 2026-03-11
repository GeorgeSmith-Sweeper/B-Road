import type { Waypoint, SegmentGeometry } from '@/types/routing';

export type RouteLeg =
  | { type: 'segment'; coordinates: [number, number][]; waypointIndex: number }
  | { type: 'osrm_gap'; from: [number, number]; to: [number, number]; viaWaypoints?: [number, number][] };

export interface StitchPlan {
  legs: RouteLeg[];
}

/**
 * Squared Euclidean distance between two [lng, lat] points.
 * Good enough for comparing relative distances without sqrt overhead.
 */
function sqDist(a: [number, number], b: [number, number]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

/**
 * Determine the traversal direction of a segment given a reference point.
 * Returns the coordinates in the correct order (possibly reversed) and
 * the entry/exit points.
 */
function orientSegment(
  geometry: SegmentGeometry,
  referencePoint: [number, number],
): { coordinates: [number, number][]; entry: [number, number]; exit: [number, number] } {
  const distToStart = sqDist(referencePoint, geometry.startCoord);
  const distToEnd = sqDist(referencePoint, geometry.endCoord);

  if (distToStart <= distToEnd) {
    // Enter from start, exit from end (natural order)
    return {
      coordinates: geometry.coordinates,
      entry: geometry.startCoord,
      exit: geometry.endCoord,
    };
  } else {
    // Enter from end, exit from start (reversed)
    return {
      coordinates: [...geometry.coordinates].reverse(),
      entry: geometry.endCoord,
      exit: geometry.startCoord,
    };
  }
}

/**
 * For the first segment waypoint, determine orientation by looking ahead
 * at the next waypoint's position.
 */
function orientFirstSegment(
  geometry: SegmentGeometry,
  nextWaypoint: Waypoint,
): { coordinates: [number, number][]; entry: [number, number]; exit: [number, number] } {
  const nextPoint: [number, number] = nextWaypoint.segmentGeometry
    ? closerEndpoint(geometry, nextWaypoint.segmentGeometry)
    : [nextWaypoint.lng, nextWaypoint.lat];

  // We want the exit of this segment to be closest to the next waypoint
  const distExitStart = sqDist(geometry.endCoord, nextPoint);
  const distExitEnd = sqDist(geometry.startCoord, nextPoint);

  if (distExitStart <= distExitEnd) {
    // Exit from end (natural order)
    return {
      coordinates: geometry.coordinates,
      entry: geometry.startCoord,
      exit: geometry.endCoord,
    };
  } else {
    // Exit from start (reversed)
    return {
      coordinates: [...geometry.coordinates].reverse(),
      entry: geometry.endCoord,
      exit: geometry.startCoord,
    };
  }
}

/**
 * Find the endpoint of segA that is closest to any endpoint of segB.
 */
function closerEndpoint(
  segA: SegmentGeometry,
  segB: SegmentGeometry,
): [number, number] {
  const distances = [
    { point: segB.startCoord, dist: Math.min(sqDist(segA.endCoord, segB.startCoord), sqDist(segA.startCoord, segB.startCoord)) },
    { point: segB.endCoord, dist: Math.min(sqDist(segA.endCoord, segB.endCoord), sqDist(segA.startCoord, segB.endCoord)) },
  ];
  return distances[0].dist <= distances[1].dist ? distances[0].point : distances[1].point;
}

/**
 * Build a stitch plan from an ordered list of waypoints.
 *
 * Waypoints with `segmentGeometry` produce `segment` legs (use geometry directly).
 * Gaps between segments (and non-segment waypoints) produce `osrm_gap` legs.
 */
export function buildStitchPlan(waypoints: Waypoint[]): StitchPlan {
  if (waypoints.length < 2) {
    return { legs: [] };
  }

  const legs: RouteLeg[] = [];
  let currentExit: [number, number] | null = null;

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];

    if (wp.segmentGeometry) {
      let oriented;

      if (currentExit === null) {
        // First waypoint is a segment — look ahead to determine direction
        const nextWp = waypoints[i + 1];
        if (nextWp) {
          oriented = orientFirstSegment(wp.segmentGeometry, nextWp);
        } else {
          // Only one waypoint with geometry (shouldn't happen with length >= 2 check,
          // but handle gracefully) — use natural order
          oriented = {
            coordinates: wp.segmentGeometry.coordinates,
            entry: wp.segmentGeometry.startCoord,
            exit: wp.segmentGeometry.endCoord,
          };
        }
      } else {
        oriented = orientSegment(wp.segmentGeometry, currentExit);
      }

      // Insert gap between previous exit and this segment's entry if needed
      if (currentExit !== null) {
        legs.push({
          type: 'osrm_gap',
          from: currentExit,
          to: oriented.entry,
        });
      }

      legs.push({
        type: 'segment',
        coordinates: oriented.coordinates,
        waypointIndex: i,
      });

      currentExit = oriented.exit;
    } else {
      // Non-segment waypoint — creates an OSRM gap
      const wpCoord: [number, number] = [wp.lng, wp.lat];

      if (currentExit !== null) {
        legs.push({
          type: 'osrm_gap',
          from: currentExit,
          to: wpCoord,
        });
      }

      currentExit = wpCoord;
    }
  }

  return { legs };
}
