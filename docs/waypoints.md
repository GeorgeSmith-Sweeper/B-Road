# Waypoints

Waypoints are placed on the map by clicking curvature segments or via the geocoder search. They define the control points for OSRM route calculation.

## Snap-to-Endpoint Behavior

When a user clicks a curvature segment, the waypoint marker is placed at the **nearest endpoint** (first or last coordinate) of the segment's LineString geometry, rather than at the click location or a midpoint. This ensures waypoints land at road junctions where segments connect, producing more predictable OSRM routing between consecutive waypoints.

The nearest endpoint is determined by squared Euclidean distance from the click position to both endpoints — no Haversine is needed since we're comparing two points on the same segment.

## Segment Highlighting

Clicking a curvature segment highlights it on the map using Mapbox GL feature state. This gives the user immediate visual feedback about which road segments are part of their route.

### How It Works

1. The curvature vector source uses `promoteId: { 'curvature': 'id' }` to map the database primary key (`cs.id`) as the Mapbox feature ID.
2. On segment click, `map.setFeatureState()` sets `{ selected: true }` on the clicked feature.
3. The `curvature-halo` and `curvature-layer` paint properties use data-driven `case` expressions that respond to the `selected` feature state:
   - **Halo layer**: opacity increases from `0.5` to `1.0` and width scales by ~1.5x when selected.
   - **Main layer**: width scales by ~1.3x when selected.
4. Selected feature IDs are tracked in a `Set` via `useRef`.

### Clearing Highlights

- **Full clear**: When all waypoints are removed (via the "Clear" button), all segment highlights are removed by calling `map.removeFeatureState()` for each tracked feature.
- **Style swap**: When the map style changes (satellite/terrain/streets), feature states are re-applied after the new style loads.
- **Individual removal**: Removing a single waypoint does not currently clear its associated segment highlight — only a full clear resets all highlights.

## Adding Waypoints

Waypoints can be added in two ways:

1. **Clicking a curvature segment** — snaps to nearest endpoint, highlights the segment, shows a popup with road info.
2. **Geocoder search** — search for an address, click "Add as Waypoint" in the popup.

## Implementation

All waypoint map interaction logic lives in `frontend/components/Map.tsx`. Waypoint state is managed by `useWaypointRouteStore` (Zustand store).
