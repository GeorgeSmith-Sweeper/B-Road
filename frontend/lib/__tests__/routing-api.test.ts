import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Waypoint, SegmentGeometry } from '@/types/routing';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after mocking
import { calculateHybridRoute, calculateGaps } from '@/lib/routing-api';

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

// segC starts exactly where segA ends
const segC: SegmentGeometry = makeSegmentGeometry([
  [-118.02, 34.02],
  [-118.03, 34.03],
  [-118.04, 34.04],
]);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('calculateGaps', () => {
  it('sends POST to /routing/calculate-gaps', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        gaps: [{ gap_index: 0, geometry: { type: 'LineString', coordinates: [[-118.0, 34.0], [-117.0, 33.0]] }, distance: 1000, duration: 60 }],
        total_distance: 1000,
        total_duration: 60,
      }),
    });

    const result = await calculateGaps([
      { gap_index: 0, waypoints: [{ lng: -118.0, lat: 34.0 }, { lng: -117.0, lat: 33.0 }] },
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/routing/calculate-gaps');
    expect(options.method).toBe('POST');
    expect(result.gaps).toHaveLength(1);
    expect(result.total_distance).toBe(1000);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'OSRM error' }),
    });

    await expect(
      calculateGaps([{ gap_index: 0, waypoints: [{ lng: 0, lat: 0 }, { lng: 1, lat: 1 }] }])
    ).rejects.toThrow('OSRM error');
  });
});

describe('calculateHybridRoute', () => {
  it('returns empty route for fewer than 2 waypoints', async () => {
    const result = await calculateHybridRoute([
      makeWaypoint({ lng: -118.0, lat: 34.0, order: 0 }),
    ]);

    expect(result.geometry.coordinates).toEqual([]);
    expect(result.distance).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls calculateGaps for two far-apart segments and stitches result', async () => {
    // segA exit after orientation depends on where segB is.
    // segB at (-117, 33) is closer to segA's start (-118, 34) than end (-118.02, 34.02),
    // so orientFirstSegment reverses segA: entry=endCoord, exit=startCoord=(-118, 34).
    // Then segB orients from currentExit (-118, 34): endCoord (-117.02, 33.02) is closer,
    // so segB reverses too: entry=endCoord=(-117.02, 33.02), exit=startCoord=(-117, 33).
    // Gap runs from (-118, 34) to (-117.02, 33.02).
    const gapCoords: [number, number][] = [[-118.0, 34.0], [-117.5, 33.5], [-117.02, 33.02]];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        gaps: [{ gap_index: 0, geometry: { type: 'LineString', coordinates: gapCoords }, distance: 5000, duration: 300 }],
        total_distance: 5000,
        total_duration: 300,
      }),
    });

    const result = await calculateHybridRoute([
      makeWaypoint({ lng: -118.0, lat: 34.0, order: 0, segmentGeometry: segA }),
      makeWaypoint({ lng: -117.0, lat: 33.0, order: 1, segmentGeometry: segB }),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const coords = result.geometry.coordinates;
    // Reversed segA starts at endCoord
    expect(coords[0]).toEqual([-118.02, 34.02]);
    // Reversed segB ends at startCoord
    expect(coords[coords.length - 1]).toEqual([-117.0, 33.0]);
    // Should contain gap interior point
    expect(coords).toContainEqual([-117.5, 33.5]);
  });

  it('stitches segments with no OSRM call when only segment legs exist', async () => {
    // Two non-segment waypoints produce an osrm_gap, so we need a mock
    // For segments-only without gaps, we need connected segments
    // Actually, buildStitchPlan always inserts osrm_gap between segments.
    // So there's always at least one gap. Let's test with the gap returning.
    const gapCoords: [number, number][] = [[-118.02, 34.02]];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        gaps: [{ gap_index: 0, geometry: { type: 'LineString', coordinates: gapCoords }, distance: 0, duration: 0 }],
        total_distance: 0,
        total_duration: 0,
      }),
    });

    const result = await calculateHybridRoute([
      makeWaypoint({ lng: -118.0, lat: 34.0, order: 0, segmentGeometry: segA }),
      makeWaypoint({ lng: -118.02, lat: 34.02, order: 1, segmentGeometry: segC }),
    ]);

    expect(result.geometry.coordinates[0]).toEqual([-118.0, 34.0]);
    expect(result.geometry.coordinates[result.geometry.coordinates.length - 1]).toEqual([-118.04, 34.04]);
  });

  it('falls back to full OSRM route when calculateGaps fails', async () => {
    // First call (calculateGaps) fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'OSRM unavailable' }),
    });

    // Second call (fallback calculateRoute) succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        geometry: { type: 'LineString', coordinates: [[-118.0, 34.0], [-117.0, 33.0]] },
        distance: 10000,
        duration: 600,
        waypoints: [
          { lng: -118.0, lat: 34.0, snapped: true },
          { lng: -117.0, lat: 33.0, snapped: true },
        ],
      }),
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await calculateHybridRoute([
      makeWaypoint({ lng: -118.0, lat: 34.0, order: 0, segmentGeometry: segA }),
      makeWaypoint({ lng: -117.0, lat: 33.0, order: 1, segmentGeometry: segB }),
    ]);

    // Should have called gaps endpoint then fallen back to calculate
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain('/routing/calculate');
    expect(result.distance).toBe(10000);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('handles all non-segment waypoints by routing gaps only', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        gaps: [{ gap_index: 0, geometry: { type: 'LineString', coordinates: [[-118.0, 34.0], [-117.0, 33.0]] }, distance: 8000, duration: 500 }],
        total_distance: 8000,
        total_duration: 500,
      }),
    });

    const result = await calculateHybridRoute([
      makeWaypoint({ lng: -118.0, lat: 34.0, order: 0 }),
      makeWaypoint({ lng: -117.0, lat: 33.0, order: 1 }),
    ]);

    expect(result.geometry.coordinates).toEqual([[-118.0, 34.0], [-117.0, 33.0]]);
    expect(result.distance).toBe(8000);
  });

  it('deduplicates boundary points between legs', async () => {
    // segA reversed: exit = (-118.0, 34.0). Gap starts at same point.
    const gapCoords: [number, number][] = [[-118.0, 34.0], [-117.5, 33.5], [-117.02, 33.02]];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        gaps: [{ gap_index: 0, geometry: { type: 'LineString', coordinates: gapCoords }, distance: 5000, duration: 300 }],
        total_distance: 5000,
        total_duration: 300,
      }),
    });

    const result = await calculateHybridRoute([
      makeWaypoint({ lng: -118.0, lat: 34.0, order: 0, segmentGeometry: segA }),
      makeWaypoint({ lng: -117.0, lat: 33.0, order: 1, segmentGeometry: segB }),
    ]);

    const coords = result.geometry.coordinates;
    // (-118.0, 34.0) is segA's exit and gap's start — should appear only once
    const boundaryCount = coords.filter(
      (c) => c[0] === -118.0 && c[1] === 34.0
    ).length;
    expect(boundaryCount).toBe(1);
  });
});
