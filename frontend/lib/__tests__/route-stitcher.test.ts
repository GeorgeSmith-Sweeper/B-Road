import { describe, it, expect } from 'vitest';
import { buildStitchPlan } from '@/lib/route-stitcher';
import type { Waypoint, SegmentGeometry } from '@/types/routing';

function makeSegmentGeometry(coords: [number, number][]): SegmentGeometry {
  return {
    coordinates: coords,
    startCoord: coords[0],
    endCoord: coords[coords.length - 1],
  };
}

function makeWaypoint(
  overrides: Partial<Waypoint> & { lng: number; lat: number; order: number },
): Waypoint {
  return {
    id: `wp-${overrides.order}`,
    isUserModified: false,
    ...overrides,
  };
}

// Two segments far apart in California
const segA: SegmentGeometry = makeSegmentGeometry([
  [-118.0, 34.0],
  [-118.01, 34.01],
  [-118.02, 34.02],
]);

const segB: SegmentGeometry = makeSegmentGeometry([
  [-117.0, 33.0],
  [-117.01, 33.01],
  [-117.02, 33.02],
]);

// A segment whose startCoord is close to segA's endCoord
const segC: SegmentGeometry = makeSegmentGeometry([
  [-118.02, 34.02], // same as segA's end
  [-118.03, 34.03],
  [-118.04, 34.04],
]);

describe('buildStitchPlan', () => {
  it('returns empty plan for fewer than 2 waypoints', () => {
    const plan = buildStitchPlan([]);
    expect(plan.legs).toEqual([]);

    const singleWp = buildStitchPlan([
      makeWaypoint({ lng: -118.0, lat: 34.0, order: 0, segmentGeometry: segA }),
    ]);
    expect(singleWp.legs).toEqual([]);
  });

  it('produces segment + osrm_gap + segment for two far-apart segments', () => {
    const plan = buildStitchPlan([
      makeWaypoint({ lng: -118.0, lat: 34.0, order: 0, segmentGeometry: segA }),
      makeWaypoint({ lng: -117.0, lat: 33.0, order: 1, segmentGeometry: segB }),
    ]);

    expect(plan.legs).toHaveLength(3);
    expect(plan.legs[0].type).toBe('segment');
    expect(plan.legs[1].type).toBe('osrm_gap');
    expect(plan.legs[2].type).toBe('segment');
  });

  it('produces two segment legs + gap for connected segments', () => {
    // segA ends at (-118.02, 34.02) and segC starts at (-118.02, 34.02)
    const plan = buildStitchPlan([
      makeWaypoint({ lng: -118.0, lat: 34.0, order: 0, segmentGeometry: segA }),
      makeWaypoint({ lng: -118.02, lat: 34.02, order: 1, segmentGeometry: segC }),
    ]);

    expect(plan.legs).toHaveLength(3);
    expect(plan.legs[0].type).toBe('segment');
    expect(plan.legs[1].type).toBe('osrm_gap');
    expect(plan.legs[2].type).toBe('segment');

    // The gap should be between the same point (zero-distance gap)
    const gap = plan.legs[1];
    if (gap.type === 'osrm_gap') {
      expect(gap.from).toEqual(gap.to);
    }
  });

  it('produces a single osrm_gap for all non-segment waypoints', () => {
    const plan = buildStitchPlan([
      makeWaypoint({ lng: -118.0, lat: 34.0, order: 0 }),
      makeWaypoint({ lng: -117.0, lat: 33.0, order: 1 }),
    ]);

    expect(plan.legs).toHaveLength(1);
    expect(plan.legs[0].type).toBe('osrm_gap');
    if (plan.legs[0].type === 'osrm_gap') {
      expect(plan.legs[0].from).toEqual([-118.0, 34.0]);
      expect(plan.legs[0].to).toEqual([-117.0, 33.0]);
    }
  });

  it('handles mixed segment and non-segment waypoints', () => {
    const plan = buildStitchPlan([
      makeWaypoint({ lng: -118.0, lat: 34.0, order: 0, segmentGeometry: segA }),
      makeWaypoint({ lng: -117.5, lat: 33.5, order: 1 }), // non-segment
      makeWaypoint({ lng: -117.0, lat: 33.0, order: 2, segmentGeometry: segB }),
    ]);

    // segment A -> gap to non-segment -> gap to segment B -> segment B
    expect(plan.legs).toHaveLength(4);
    expect(plan.legs[0].type).toBe('segment');
    expect(plan.legs[1].type).toBe('osrm_gap'); // segA exit -> non-segment
    expect(plan.legs[2].type).toBe('osrm_gap'); // non-segment -> segB entry
    expect(plan.legs[3].type).toBe('segment');
  });

  it('starts with osrm_gap when first waypoint has no segment', () => {
    const plan = buildStitchPlan([
      makeWaypoint({ lng: -118.5, lat: 34.5, order: 0 }), // non-segment
      makeWaypoint({ lng: -118.0, lat: 34.0, order: 1, segmentGeometry: segA }),
    ]);

    expect(plan.legs).toHaveLength(2);
    expect(plan.legs[0].type).toBe('osrm_gap');
    expect(plan.legs[1].type).toBe('segment');
  });

  it('reverses segment coordinates when closer to endCoord', () => {
    // segB starts at (-117.0, 33.0) and ends at (-117.02, 33.02)
    // If we approach from (-117.02, 33.02), it should reverse to enter from end
    const plan = buildStitchPlan([
      makeWaypoint({ lng: -117.02, lat: 33.02, order: 0 }), // close to segB's end
      makeWaypoint({ lng: -117.0, lat: 33.0, order: 1, segmentGeometry: segB }),
    ]);

    expect(plan.legs).toHaveLength(2);
    const segLeg = plan.legs[1];
    if (segLeg.type === 'segment') {
      // Coordinates should be reversed — first coord should be endCoord
      expect(segLeg.coordinates[0]).toEqual([-117.02, 33.02]);
      expect(segLeg.coordinates[segLeg.coordinates.length - 1]).toEqual([-117.0, 33.0]);
    }
  });

  it('orients first segment based on next waypoint position', () => {
    // segA: start (-118.0, 34.0), end (-118.02, 34.02)
    // Next waypoint is near segA's start, so segA should reverse
    // (exit should be closest to next)
    const plan = buildStitchPlan([
      makeWaypoint({ lng: -118.0, lat: 34.0, order: 0, segmentGeometry: segA }),
      makeWaypoint({ lng: -118.03, lat: 34.03, order: 1 }), // closer to segA end
    ]);

    const segLeg = plan.legs[0];
    if (segLeg.type === 'segment') {
      // Next waypoint at (-118.03, 34.03) is closer to segA's endCoord (-118.02, 34.02)
      // So exit should be endCoord — natural order
      expect(segLeg.coordinates[0]).toEqual([-118.0, 34.0]);
      expect(segLeg.coordinates[segLeg.coordinates.length - 1]).toEqual([-118.02, 34.02]);
    }
  });

  it('orients first segment reversed when next waypoint is near start', () => {
    // Next waypoint is closer to segA's startCoord than endCoord
    // So the segment should reverse (exit from start)
    const plan = buildStitchPlan([
      makeWaypoint({ lng: -118.02, lat: 34.02, order: 0, segmentGeometry: segA }),
      makeWaypoint({ lng: -117.99, lat: 33.99, order: 1 }), // closer to segA start
    ]);

    const segLeg = plan.legs[0];
    if (segLeg.type === 'segment') {
      // Next waypoint at (-117.99, 33.99) is closer to segA's startCoord (-118.0, 34.0)
      // So exit should be startCoord — reversed order
      expect(segLeg.coordinates[0]).toEqual([-118.02, 34.02]);
      expect(segLeg.coordinates[segLeg.coordinates.length - 1]).toEqual([-118.0, 34.0]);
    }
  });

  it('handles three consecutive segments', () => {
    const segD: SegmentGeometry = makeSegmentGeometry([
      [-118.04, 34.04], // starts at segC's end
      [-118.05, 34.05],
    ]);

    const plan = buildStitchPlan([
      makeWaypoint({ lng: -118.0, lat: 34.0, order: 0, segmentGeometry: segA }),
      makeWaypoint({ lng: -118.02, lat: 34.02, order: 1, segmentGeometry: segC }),
      makeWaypoint({ lng: -118.04, lat: 34.04, order: 2, segmentGeometry: segD }),
    ]);

    // segment + gap + segment + gap + segment
    expect(plan.legs).toHaveLength(5);
    expect(plan.legs.map(l => l.type)).toEqual([
      'segment', 'osrm_gap', 'segment', 'osrm_gap', 'segment',
    ]);
  });

  it('preserves waypointIndex on segment legs', () => {
    const plan = buildStitchPlan([
      makeWaypoint({ lng: -118.0, lat: 34.0, order: 0, segmentGeometry: segA }),
      makeWaypoint({ lng: -117.5, lat: 33.5, order: 1 }),
      makeWaypoint({ lng: -117.0, lat: 33.0, order: 2, segmentGeometry: segB }),
    ]);

    const segLegs = plan.legs.filter(l => l.type === 'segment');
    expect(segLegs).toHaveLength(2);
    if (segLegs[0].type === 'segment') expect(segLegs[0].waypointIndex).toBe(0);
    if (segLegs[1].type === 'segment') expect(segLegs[1].waypointIndex).toBe(2);
  });

  it('handles consecutive non-segment waypoints with individual gaps', () => {
    const plan = buildStitchPlan([
      makeWaypoint({ lng: -118.0, lat: 34.0, order: 0 }),
      makeWaypoint({ lng: -117.5, lat: 33.5, order: 1 }),
      makeWaypoint({ lng: -117.0, lat: 33.0, order: 2 }),
    ]);

    // Each pair of consecutive non-segment waypoints produces a gap
    expect(plan.legs).toHaveLength(2);
    expect(plan.legs[0].type).toBe('osrm_gap');
    expect(plan.legs[1].type).toBe('osrm_gap');
  });
});
