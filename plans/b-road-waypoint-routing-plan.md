# B-Road Waypoint Routing Implementation Plan

## Project Overview

**Objective**: Add Google Maps-style draggable waypoint routing to B-Road as a **second mode** alongside the existing segment-list route builder. Users click curvature segments to highlight them and create waypoints at segment endpoints, with OSRM calculating connecting routes via the road network. Waypoints are draggable to modify routes.

**Repository**: https://github.com/GeorgeSmith-Sweeper/B-Road
**Base Branch**: `main`
**Feature Branch**: `feature/waypoint-routing`

**Core Principle**: This is an additive feature. The existing segment-list route builder, viewport-based segment loading, curvature filtering, and map interactions must remain unchanged.

---

## Key Decisions (from planning discussion)

| Decision | Choice |
|----------|--------|
| Relationship to existing route builder | Second mode alongside existing segment-list builder |
| Segment click behavior (waypoint mode) | Click → highlight entire segment → waypoints snap to first/last coordinates → OSRM connects to previous waypoints |
| Waypoint source coordinates | First/last coordinates from segment geometry |
| UI placement | Waypoint list in existing sidebar panel; no "start building" button — works natively like Google Maps (click to begin) |
| OSRM region for dev | North Carolina (`north-carolina`) |
| OSRM scaling strategy | Single state for dev; swap to full US extract (`us-latest.osm.pbf`) for production |
| OSRM Docker approach | Profile (`routing`) in main `docker-compose.yml` |
| Backend routing HTTP client | Proper async `httpx` |
| `/routing/preview` vs `/routing/calculate` | Same endpoint initially |
| Authentication | Keep existing session-based auth (`X-Session-Id` in localStorage) |
| KML/GPX export | Included in this work; exports full OSRM road-snapped geometry |
| `saved_routes` table | Already exists — add `route_waypoints` table and `connecting_geometry` column |

---

## Existing Infrastructure (already implemented)

The following already exists and **must not be modified** unless extending:

- **Database tables**: `route_sessions`, `saved_routes`, `route_segments` (schema: `api/schema/saved_routes.sql`)
- **ORM models**: `RouteSession`, `SavedRoute`, `RouteSegment` in `api/models/orm.py`
- **Route API**: Full CRUD in `api/routers/routes.py` with service/repository layers
- **Frontend route store**: `frontend/store/useRouteStore.ts` (Zustand) — manages segment-list building
- **Route builder UI**: `RouteBuilderPanel.tsx` with "Build Route" / "My Routes" tabs, save dialog, segment list
- **Map click handler**: `Map.tsx` (lines ~140-223) — toggles between building mode and popup mode
- **Curvature pipeline**: `scripts/process_us_states.sh` — downloads and processes all 50 states

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERACTION                        │
├─────────────────────────────────────────────────────────────┤
│  1. Click curvature segment on map                          │
│  2. Segment highlights, waypoints appear at endpoints       │
│  3. OSRM calculates connecting route to previous waypoints  │
│  4. User can drag waypoints to modify route                 │
│  5. Save route with name/description                        │
│  6. Export to KML/GPX                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  NEXT.JS FRONTEND (React)                    │
├─────────────────────────────────────────────────────────────┤
│  NEW Components:                                            │
│  • WaypointRouteBuilder.tsx - waypoint mode UI              │
│  • WaypointMarker.tsx - draggable marker component          │
│                                                              │
│  NEW Zustand Store:                                         │
│  • useWaypointRouteStore - waypoints, OSRM route state      │
│                                                              │
│  NEW Hooks:                                                  │
│  • useRouting - OSRM API calls with debouncing              │
│  • useWaypointMarkers - Mapbox marker management            │
│                                                              │
│  EXISTING (extended):                                       │
│  • Sidebar.tsx - add waypoint mode tab                      │
│  • Map.tsx - add waypoint click handler branch              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     FASTAPI BACKEND                          │
├─────────────────────────────────────────────────────────────┤
│  NEW Endpoints (api/routers/routing.py):                    │
│  • POST /routing/calculate  ← Waypoints → OSRM route       │
│  • GET  /routing/health     ← OSRM status                  │
│                                                              │
│  EXTENDED Endpoints:                                        │
│  • POST /routes             ← Accept optional waypoints     │
│  • GET  /routes/{id}        ← Return waypoints if present   │
│  • GET  /routes/{slug}/export/kml (NEW)                     │
│  • GET  /routes/{slug}/export/gpx (NEW)                     │
│                                                              │
│  EXISTING (unchanged):                                      │
│  • GET /curvature/segments  ← Viewport-based loading        │
│  • GET /curvature/sources   ← State list                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   OSRM (Docker Service)                      │
├─────────────────────────────────────────────────────────────┤
│  • Profile: "routing" in docker-compose.yml                 │
│  • Dev region: north-carolina                               │
│  • Production: us-latest (swap data file)                   │
│  • Internal port 5000                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       POSTGRESQL                             │
├─────────────────────────────────────────────────────────────┤
│  EXISTING: route_sessions, saved_routes, route_segments,    │
│            curvature_segments, segment_ways, sources, tags   │
│                                                              │
│  NEW TABLE: route_waypoints (ordered waypoints w/ refs)     │
│  NEW COLUMN: saved_routes.connecting_geometry               │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: OSRM Infrastructure Setup

**Goal**: Add OSRM routing engine to existing Docker infrastructure.

**Tasks**:
1. Add OSRM service to `docker-compose.yml` with `profiles: [routing]`
2. Create `scripts/prepare-osrm.sh` — download and preprocess OSM data for OSRM
3. Update `.env.example` with OSRM variables
4. Update `.gitignore` for OSRM-generated files

**Acceptance Criteria**:
- [ ] `docker compose up` still starts existing services (OSRM does NOT start)
- [ ] `docker compose --profile routing up` starts OSRM alongside other services
- [ ] `curl http://localhost:5000/route/v1/driving/-80.8,35.2;-80.7,35.3` returns route (NC coords)
- [ ] `scripts/prepare-osrm.sh north-carolina` downloads and preprocesses data
- [ ] Script accepts any US state name matching Geofabrik naming

---

### Phase 2: Backend Routing Endpoints

**Goal**: Add routing API endpoints using proper async httpx.

**Tasks**:
1. Create `api/routers/routing.py` with calculate and health endpoints
2. Create `api/models/routing.py` with Pydantic models
3. Create `api/services/osrm_service.py` for async OSRM communication
4. Register router in `api/server.py`

**Endpoints**:
- `POST /routing/calculate` — accepts waypoints array, returns GeoJSON LineString + distance/duration
- `GET /routing/health` — reports OSRM availability

**Acceptance Criteria**:
- [ ] All existing API tests pass
- [ ] New endpoints return valid GeoJSON routes
- [ ] 503 with clear message when OSRM unavailable
- [ ] Uses async httpx (not synchronous calls)

---

### Phase 3: Database Schema Extension

**Goal**: Add waypoint storage without modifying existing tables.

**Tasks**:
1. Create `api/schema/waypoints_migration.sql` — `route_waypoints` table
2. Add `connecting_geometry` column to `saved_routes` (idempotent)
3. Create/update SQLAlchemy models

**Acceptance Criteria**:
- [ ] Migration is idempotent (safe to run multiple times)
- [ ] Existing routes still load correctly
- [ ] No modifications to existing table structures

---

### Phase 4: Frontend — Waypoint Route Builder

**Goal**: Add waypoint routing mode using React components and Zustand, integrated into existing sidebar.

**UX Flow**:
1. User clicks a curvature segment on the map
2. Segment highlights (full geometry)
3. Waypoints snap to first/last coordinates of segment
4. If previous waypoints exist, OSRM calculates connecting route
5. Route line renders on map following road network
6. Waypoint list appears in sidebar (alongside existing route builder tabs)
7. Waypoints are draggable — route preview during drag, recalculate on drop
8. No explicit "start building" button — clicking a segment begins the flow natively

**Tasks**:
1. Create `frontend/types/routing.ts` — TypeScript interfaces
2. Create `frontend/store/useWaypointRouteStore.ts` — Zustand store
3. Create `frontend/hooks/useRouting.ts` — OSRM API calls with debouncing
4. Create `frontend/hooks/useWaypointMarkers.ts` — Mapbox marker management
5. Create `frontend/components/WaypointRouteBuilder.tsx` — sidebar panel
6. Extend `Map.tsx` — add waypoint click handler branch
7. Extend `Sidebar.tsx` — add waypoint mode tab

**Acceptance Criteria**:
- [ ] Existing map and route builder functionality unchanged
- [ ] Clicking segments adds waypoints at endpoints
- [ ] Segments highlight on click
- [ ] OSRM route renders between waypoints
- [ ] Markers are draggable with route preview
- [ ] TypeScript compiles without errors

---

### Phase 5: Save Flow & Export Integration

**Goal**: Extend existing save/retrieve to include waypoints and add KML/GPX export.

**Tasks**:
1. Extend `POST /routes` to accept optional waypoints and connecting_geometry
2. Extend `GET /routes/{id}` to return waypoints if present
3. Add `GET /routes/{slug}/export/gpx` endpoint
4. Add `GET /routes/{slug}/export/kml` endpoint
5. Update frontend save flow to include waypoints
6. Add export buttons to UI

**Acceptance Criteria**:
- [x] Existing saved routes still load correctly (backward compatible)
- [x] New routes save with waypoints and connecting geometry
- [x] GPX export includes full road-snapped route
- [x] KML export includes full road-snapped route
- [ ] Full lifecycle: click → drag → save → load → export → delete

---

## Branch Strategy

```
main
 └── feature/waypoint-routing
     ├── Phase 1: OSRM infrastructure
     ├── Phase 2: Backend routing endpoints
     ├── Phase 3: Database schema extension
     ├── Phase 4: Frontend waypoint builder
     └── Phase 5: Save flow & export
```

---

## Testing Strategy

- **Existing tests must pass at every phase**
- **Backend**: pytest with mocked OSRM (unit), real OSRM (integration)
- **Frontend**: Jest + React Testing Library for stores and hooks
- **Tests run in Docker**: `docker compose exec -w /app/api api python -m pytest`
- **Integration tests**: marked with `@pytest.mark.integration`, skipped if OSRM unavailable

---

## Rollback Plan

Each phase is independently reversible:
- **Phase 1**: Remove OSRM service from docker-compose.yml
- **Phase 2**: Remove router registration from server.py, delete routing files
- **Phase 3**: `DROP TABLE IF EXISTS route_waypoints;` — nullable column can stay
- **Phase 4**: Remove new components, revert Map.tsx and Sidebar.tsx changes
- **Phase 5**: Revert save endpoint extensions, remove export endpoints
