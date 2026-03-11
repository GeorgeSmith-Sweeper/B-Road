# Hybrid Stitching Route Plan

**Created:** 2026-03-11
**Branch:** `chore/updating-route-logic`
**Status:** In progress (Steps 1-4 complete)

## Goal

When a user selects curvature segments, use the segment's own geometry for traversal and only use OSRM for connecting gaps between segments. This guarantees the user drives every meter of their selected curvy roads.

**Mental model:** "You pick the fun roads. We connect them."

## Current System

1. User clicks a curvature segment on the map
2. Click handler snaps to the **nearest endpoint** (first or last coordinate)
3. A single `[lng, lat]` waypoint is added to the store
4. All waypoints sent to OSRM in one `POST /routing/calculate` call
5. OSRM returns a single geometry optimized for efficiency (may skip the actual segment)
6. Route rendered on map

## Target System

1. User clicks a segment -> store full segment geometry + both endpoints
2. Determine traversal direction based on proximity to previous segment's exit
3. OSRM calls only for gaps between segments (prev segment end -> next segment start)
4. Stitch final route: alternating segment geometries + OSRM connections
5. Keep existing visual identity (no rendering changes yet)

## Dependency Graph

```
Steps 1 -> 2 -> 3 -> 5 -> 6
Step 4 (parallel with 1-3, backend-only)
Steps 7, 8, 9, 10 (after 6, independent of each other)
```

---

## Step 1: Extend Frontend Types to Hold Segment Geometry

**Status:** Done (commit 0123947)
**Depends on:** Nothing
**Parallelizable:** Yes (no conflicts with Step 4)

### Context for Agent

This step adds type definitions only. No runtime behavior changes.

### Files to Modify

- `frontend/types/routing.ts` — Add `SegmentGeometry` type and extend `Waypoint` interface

### What to Do

1. Add a new type to `routing.ts`:

```typescript
export interface SegmentGeometry {
  coordinates: [number, number][];  // full LineString coords from vector tile feature
  startCoord: [number, number];     // coordinates[0]
  endCoord: [number, number];       // coordinates[coordinates.length - 1]
}
```

2. Add an optional field to the existing `Waypoint` interface:

```typescript
segmentGeometry?: SegmentGeometry;
```

### How to Verify

- Project compiles with no type errors: `cd frontend && npx tsc --noEmit`
- Existing behavior unchanged (the field is optional)

### Revert Strategy

Remove the new type and the optional field. No runtime impact.

---

## Step 2: Capture Full Segment Geometry on Click

**Status:** Done (commit 528a67c)
**Depends on:** Step 1
**Parallelizable:** Yes (no conflicts with Step 4)

### Context for Agent

Currently the click handler in `Map.tsx` extracts only the first/last coordinate of a clicked segment and snaps the waypoint to the nearest one. We need to also capture the full coordinate array and pass it through to the store.

### Files to Modify

- `frontend/components/Map.tsx` — Segment click handler (~lines 397-420). Look for `map.on('click', 'curvature-layer')` and the snap-to-nearest-end logic.
- `frontend/store/useWaypointRouteStore.ts` — `addWaypoint` action needs to accept and store an optional `SegmentGeometry`.

### What to Do

1. In `Map.tsx` click handler:
   - After extracting `coords` from `feature.geometry.coordinates`, build a `SegmentGeometry` object:
     - `coordinates`: the full `coords` array (cast to `[number, number][]`)
     - `startCoord`: `coords[0]`
     - `endCoord`: `coords[coords.length - 1]`
   - Pass this to `addWaypoint` as an additional parameter.

2. In `useWaypointRouteStore.ts`:
   - Update `addWaypoint` signature to accept optional `segmentGeometry?: SegmentGeometry`.
   - Store it on the new waypoint object.
   - In `updateWaypoint` (drag handler), clear `segmentGeometry` by setting it to `undefined` — a dragged waypoint is no longer segment-bound.

### How to Verify

- Click a segment on the map, open React DevTools, inspect the waypoint store — confirm `segmentGeometry` is populated with coordinates array.
- Drag a waypoint — confirm `segmentGeometry` is cleared.
- Existing snap-to-endpoint behavior is unchanged.

### Revert Strategy

Remove geometry extraction from click handler, remove the parameter from `addWaypoint`. Store reverts to ignoring the field.

---

## Step 3: Build the Stitch Plan Logic (Pure Functions)

**Status:** Done (commit 9d93435) — also set up vitest as frontend test runner
**Depends on:** Step 1 (types only)
**Parallelizable:** Yes (no conflicts with Steps 2 or 4)

### Context for Agent

This step creates the core algorithm as pure functions with no side effects or API calls. It takes an ordered list of waypoints and produces a "stitch plan" — an ordered list of route legs.

### Files to Create

- `frontend/lib/route-stitcher.ts` — New file with pure functions
- `frontend/lib/__tests__/route-stitcher.test.ts` — Unit tests

### Types to Define (in route-stitcher.ts)

```typescript
export type RouteLeg =
  | { type: 'segment'; coordinates: [number, number][]; waypointIndex: number }
  | { type: 'osrm_gap'; from: [number, number]; to: [number, number]; viaWaypoints?: [number, number][] }

export interface StitchPlan {
  legs: RouteLeg[];
}
```

### Core Function: `buildStitchPlan(waypoints: Waypoint[]): StitchPlan`

**Algorithm:**
1. Walk through waypoints in order.
2. Track a `currentExitPoint: [number, number] | null` — the last known position.
3. For each waypoint with `segmentGeometry`:
   - Determine traversal direction: compare `currentExitPoint` distance to `startCoord` vs `endCoord`. If closer to `endCoord`, reverse the coordinates array.
   - If there's a gap between `currentExitPoint` and this segment's entry point, insert an `osrm_gap` leg.
   - Insert a `segment` leg with the (possibly reversed) coordinates.
   - Update `currentExitPoint` to the segment's exit point.
4. For waypoints without `segmentGeometry`:
   - If there's a `currentExitPoint`, insert an `osrm_gap` from `currentExitPoint` to this waypoint's `[lng, lat]`.
   - Update `currentExitPoint` to this waypoint's `[lng, lat]`.
5. For the first waypoint: if it has a segment, determine direction based on the second waypoint's position (look ahead).

### Edge Cases to Handle

- **Single waypoint:** Return empty plan (no route to calculate).
- **Two waypoints, no segments:** Single `osrm_gap` leg (equivalent to current behavior).
- **All segments, all connected:** Only `segment` legs, no OSRM needed.
- **Mixed segment + non-segment waypoints:** Gaps between segment exits and non-segment waypoints.
- **First waypoint is a segment:** Direction determined by looking at second waypoint.
- **Consecutive non-segment waypoints:** Group into one `osrm_gap` with `viaWaypoints`.

### Unit Tests to Write

1. Two segment waypoints far apart -> `[segment, osrm_gap, segment]`
2. Two segment waypoints sharing an endpoint -> `[segment, segment]` (no gap)
3. Single segment waypoint -> empty plan
4. Mixed: segment, non-segment, segment -> `[segment, osrm_gap, osrm_gap, segment]` or `[segment, osrm_gap_to_nonseg, osrm_gap_to_seg, segment]`
5. All non-segment waypoints -> single `osrm_gap`
6. Direction reversal: second segment's `endCoord` is closer to first segment's exit -> coordinates reversed
7. First waypoint is a segment with no prior context -> direction determined by second waypoint

### How to Verify

- All unit tests pass: `cd frontend && npx jest route-stitcher`
- No type errors: `cd frontend && npx tsc --noEmit`

### Revert Strategy

Delete `route-stitcher.ts` and its test file. No other code depends on it yet.

---

## Step 4: New Backend Endpoint for Gap Routing

**Status:** Done (commit f04e251) — includes parallel asyncio.gather and 10 new tests
**Depends on:** Nothing
**Parallelizable:** Yes (fully independent of Steps 1-3)

### Context for Agent

The existing `POST /routing/calculate` sends ALL waypoints to OSRM in one call. The hybrid system needs to route only the gaps between segments. This step adds a new endpoint that accepts multiple independent gap requests and returns OSRM routes for each.

The existing endpoint must remain unchanged for backward compatibility.

### Files to Modify

- `api/models/routing.py` — Add new request/response Pydantic models
- `api/services/osrm_service.py` — Add `calculate_gaps` method
- `api/routers/routing.py` — Add `POST /routing/calculate-gaps` endpoint

### New Models (in `api/models/routing.py`)

```python
class GapRequest(BaseModel):
    gap_index: int
    waypoints: List[WaypointRequest] = Field(..., min_length=2)

class CalculateGapsRequest(BaseModel):
    gaps: List[GapRequest] = Field(..., min_length=1)

class GapResponse(BaseModel):
    gap_index: int
    geometry: RouteGeometry
    distance: float  # meters
    duration: float  # seconds

class CalculateGapsResponse(BaseModel):
    gaps: List[GapResponse]
    total_distance: float
    total_duration: float
```

### New Service Method (in `api/services/osrm_service.py`)

```python
async def calculate_gaps(self, gaps: list[GapRequest]) -> CalculateGapsResponse:
    # For each gap, make an independent OSRM route call
    # Use asyncio.gather for parallel execution
    # Return results keyed by gap_index
    # If a single gap fails, raise with clear error (which gap failed)
```

Each gap uses the same OSRM logic as the existing `calculate_route` — construct `/route/v1/driving/lng,lat;lng,lat;...` URL with `overview=full&geometries=geojson&steps=false`.

### New Endpoint (in `api/routers/routing.py`)

```python
@router.post("/routing/calculate-gaps", response_model=CalculateGapsResponse)
async def calculate_gaps(request: CalculateGapsRequest):
    ...
```

### How to Test

**Unit tests** (mocked OSRM):
1. Single gap with 2 waypoints -> returns 1 GapResponse
2. Multiple gaps -> returns matching number of GapResponses
3. Gap with 3+ waypoints (non-segment via points) -> OSRM receives all
4. Invalid gap (< 2 waypoints) -> validation error

**Integration tests** (real OSRM, Docker):
1. Two real coordinates -> valid geometry returned
2. Multiple gaps -> all return valid geometries
3. `total_distance` = sum of individual gap distances

Run tests: `docker compose exec -w /app/api api python -m pytest tests/ -k "gap" --no-cov`

### Revert Strategy

Remove the new endpoint, models, and service method. Existing `/routing/calculate` unaffected.

---

## Step 5: Frontend `calculateHybridRoute` Function

**Status:** Not started
**Depends on:** Steps 3 and 4
**Parallelizable:** No (needs both stitch plan logic and backend endpoint)

### Context for Agent

This function orchestrates the full hybrid flow: build a stitch plan, call the backend for OSRM gaps, and stitch everything into one GeoJSON LineString.

### Files to Modify

- `frontend/lib/routing-api.ts` — Add `calculateHybridRoute` function and `calculateGaps` API call

### What to Do

1. Add API function to call the new backend endpoint:

```typescript
export async function calculateGaps(gaps: GapRequest[]): Promise<CalculateGapsResponse> {
  // POST to ${API_BASE_URL}/routing/calculate-gaps
}
```

2. Add orchestration function:

```typescript
export async function calculateHybridRoute(waypoints: Waypoint[]): Promise<CalculatedRoute> {
  // 1. Build stitch plan
  const plan = buildStitchPlan(waypoints);

  // 2. If no osrm_gap legs, stitch segment geometries directly
  // 3. If gaps exist, call calculateGaps for OSRM routing
  // 4. Stitch all legs into one LineString (concatenate coordinates in order)
  // 5. Sum distances (segment geodesic + OSRM gap distances)
  // 6. Return as CalculatedRoute shape
}
```

3. **Fallback**: If `calculateGaps` fails (e.g., backend not updated yet), fall back to calling the existing `calculateRoute` with all waypoint coordinates. Log a warning.

### Geometry Stitching Detail

When concatenating coordinates from multiple legs, avoid duplicate points at leg boundaries. If `leg[n].coordinates[last]` equals `leg[n+1].coordinates[first]`, skip the duplicate.

### How to Verify

- Unit test with mocked `calculateGaps`: verify stitched geometry is correct.
- Manual: temporarily wire into the app and test with 2 segment waypoints.
- No type errors: `cd frontend && npx tsc --noEmit`

### Revert Strategy

Remove the new functions from `routing-api.ts`. Nothing calls them yet.

---

## Step 6: Wire into `useRouting` Hook (The Switchover)

**Status:** Not started
**Depends on:** Steps 2 and 5
**Parallelizable:** No (this is the integration point)

### Context for Agent

This is the single switchover point. The `useRouting` hook currently calls `calculateRoute` for every recalculation. We change it to call `calculateHybridRoute` when any waypoints have segment geometry.

### Files to Modify

- `frontend/hooks/useRouting.ts` — Modify `recalculateRoute` and `previewRoute`

### What to Do

1. In `recalculateRoute(waypoints)`:
   - Check if any waypoint has `segmentGeometry` defined.
   - If yes: call `calculateHybridRoute(waypoints)`.
   - If no: call existing `calculateRoute(waypoints)` (pure OSRM, current behavior).
   - The result shape (`CalculatedRoute`) is the same either way, so the store update is unchanged.

2. In `previewRoute(waypoints)` (debounced drag preview):
   - Same logic, but consider: during a drag, the dragged waypoint's `segmentGeometry` is already cleared (Step 2), so if only one remaining waypoint has geometry, the hybrid path still works.

### How to Verify (Manual Testing Checklist)

- [ ] Click 2 segments far apart -> route follows each segment's geometry, OSRM connects the gap
- [ ] Click 2 segments that share an endpoint -> route follows both segments with no OSRM gap
- [ ] Click 1 segment -> single waypoint, no route (existing behavior)
- [ ] Click 3+ segments -> all segments traversed fully
- [ ] Remove a middle segment -> route recalculates with larger gap
- [ ] Reorder waypoints via drag-and-drop list -> route recalculates with correct segment directions
- [ ] Drag a waypoint marker on map -> segment geometry cleared, route recalculates
- [ ] Mix of segment clicks and address/manual waypoints -> gaps routed correctly
- [ ] Performance: route calculates within reasonable time (< 2 seconds for 5 segments)

### Revert Strategy

Revert the hook to call `calculateRoute` unconditionally. All other steps remain inert but functional.

---

## Step 7: Distance and Duration Accounting

**Status:** Not started
**Depends on:** Step 6
**Parallelizable:** Yes (independent of Steps 8-10)

### Context for Agent

After hybrid stitching is wired up, the `distance` and `duration` in `CalculatedRoute` only reflect OSRM gaps. Segment legs need their own distance/duration contribution.

### Files to Modify

- `frontend/lib/route-stitcher.ts` — Add `haversineDistance` utility
- `frontend/lib/routing-api.ts` — Use it in `calculateHybridRoute`

### What to Do

1. Add Haversine distance function that computes geodesic distance for a series of `[lng, lat]` coordinates.
2. In `calculateHybridRoute`, after stitching:
   - Sum segment leg distances (Haversine over their coordinates).
   - Sum OSRM gap distances (from API response).
   - Estimate segment duration at ~30 mph (48 km/h) for curvy roads.
   - Set `distance` and `duration` on the returned `CalculatedRoute`.

### How to Verify

- Unit test Haversine function against known distances.
- Compare total hybrid distance vs all-OSRM distance — should be similar order of magnitude.
- `RouteStats` component displays reasonable values.

### Revert Strategy

Remove Haversine utility and revert distance calculation. Distances fall back to OSRM-only values.

---

## Step 8: Save/Load Route Persistence

**Status:** Not started
**Depends on:** Step 6
**Parallelizable:** Yes (independent of Steps 7, 9, 10)

### Context for Agent

Saved routes need to include segment geometries so that when a route is loaded, hybrid stitching can reconstruct the exact route. The backend stores route data as a JSON blob, so no schema migration is needed.

### Files to Modify

- `frontend/components/planner/SaveRouteModal.tsx` — Include `segmentGeometry` in waypoint data sent to backend
- `frontend/app/planner/page.tsx` or route loading logic — Reconstruct `segmentGeometry` when loading a saved route
- `frontend/types/routing.ts` — Ensure saved waypoint types include optional `segmentGeometry`

### Backward Compatibility

- Old saved routes: waypoints have no `segmentGeometry` -> loaded as `undefined` -> falls through to all-OSRM path (existing behavior preserved).
- New saved routes: include geometry -> hybrid stitching works on reload.

### How to Verify

- Save a hybrid route with 2+ segments, reload the page with `?route=<id>`, verify the route geometry is identical.
- Load an old saved route (created before this change), verify it still renders correctly.

### Revert Strategy

Stop saving/loading the extra field. Old routes unaffected, new routes fall back to OSRM.

---

## Step 9: Parallelize OSRM Gap Calls

**Status:** Not started
**Depends on:** Step 4
**Parallelizable:** Yes (independent of Steps 7, 8, 10)

### Context for Agent

If the backend `calculate_gaps` method processes gaps sequentially, routes with many segments will be slow. This step ensures gaps are routed in parallel.

### Files to Modify

- `api/services/osrm_service.py` — Use `asyncio.gather` in `calculate_gaps`

### What to Do

Replace sequential gap processing with:
```python
results = await asyncio.gather(*[self._calculate_single_gap(gap) for gap in gaps])
```

Add error handling: if one gap fails, still return results for successful gaps with clear error info.

### How to Verify

- Integration test with 3+ gaps, all return valid results.
- Measure latency: N gaps should take ~1x OSRM call time, not Nx.

### Revert Strategy

Revert to sequential processing. Functional but slower.

---

## Step 10: "Close Enough" Threshold to Skip Tiny Gaps

**Status:** Not started
**Depends on:** Step 3
**Parallelizable:** Yes (can be added anytime after Step 3)

### Context for Agent

If two consecutive segments share an endpoint (or are very close), there's no need for an OSRM call. This optimization reduces unnecessary API calls.

### Files to Modify

- `frontend/lib/route-stitcher.ts` — Add threshold check in `buildStitchPlan`

### What to Do

In `buildStitchPlan`, before creating an `osrm_gap` leg:
1. Compute geodesic distance between the two endpoints.
2. If under 50 meters, skip the gap (connect directly or omit the leg).
3. Make the threshold configurable (default 50m).

### How to Verify

- Unit test: two segments sharing exact endpoint -> no gap leg.
- Unit test: two segments 30m apart -> no gap leg.
- Unit test: two segments 200m apart -> gap leg created.

### Revert Strategy

Remove threshold logic. All gaps go through OSRM.

---

## Agent Assignment Notes

Each step is designed to be picked up by an independent agent. Key guidelines:

- **Read the files listed in "Files to Modify" before making changes.** Verify current state — don't trust this plan blindly for exact line numbers or code structure.
- **Run type checks** after any TypeScript change: `cd frontend && npx tsc --noEmit`
- **Don't modify files outside your step's scope** unless it's a trivial import addition.
- **If something doesn't match this plan** (e.g., the `Waypoint` interface is in a different file), adapt and note the discrepancy.
- **Tests run in Docker** for backend: `docker compose exec -w /app/api api python -m pytest tests/ --no-cov`
- **Frontend tests**: `cd frontend && npx jest <test-file>`
- **Commit each step separately** with a clear message referencing this plan (e.g., `feat(routing): step 1 - extend types for segment geometry`).
