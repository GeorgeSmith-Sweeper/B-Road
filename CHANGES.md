# B-Road Change Summary

## Overview

This document tracks the major architectural changes and feature additions to B-Road, from its transition to a PostGIS-backed platform through ongoing improvements.

---

## February 3, 2026 - Full US Data Load

**Commit**: `ca826c5` - "Load all 50 US states into PostGIS (2.1M segments)"

### Milestone Achievement

Successfully loaded curvature data for all 50 US states into PostGIS, making the full nationwide curvy road dataset available for visualization.

### Final Statistics

| Metric | Value |
|--------|-------|
| Sources | 51 (50 US states + Monaco) |
| Total segments | **2,135,638** |
| Database size | **2.6 GB** |
| Processing time | ~5 hours |

### Top States by Segment Count

| State | Segments |
|-------|----------|
| Texas | 186,103 |
| California | 152,562 |
| North Carolina | 106,672 |
| Florida | 99,833 |
| Pennsylvania | 94,306 |

### Bug Fixes

#### NULL Geometry Crash in curvature-output-postgis

**Problem**: When using `--clear` on a source with no existing data, `ST_Union` returns `NULL`, causing a crash in `BBox.from_geojson_string()`.

**Fix** (`bin/curvature-output-postgis:59`):
```python
# Before
if result is not None:

# After
if result is not None and result[0] is not None:
```

### Infrastructure Improvements

#### Docker Shared Memory for PostgreSQL

**Problem**: `VACUUM ANALYZE` failed on 2.1M row table with "No space left on device" error due to Docker's default 64MB shared memory limit.

**Fix** (`docker-compose.yml`):
```yaml
db:
  image: postgis/postgis:15-3.4-alpine
  shm_size: 256m  # Added for large table operations
```

### Data Processing Notes

- Downloads sourced from Geofabrik OSM extracts
- Two network interruptions required resume with `-r` flag
- Resume correctly picked up failed downloads and continued
- Cross-border road duplicates handled correctly (`ON CONFLICT DO NOTHING`)
- Processing script: `scripts/process_us_states.sh`

### Verification Steps Completed

1. VACUUM ANALYZE on all tables
2. API sources endpoint returns all 51 sources
3. Frontend map displays segments across entire US

---

## February 2026 - CI/CD Stabilization

**PR**: #15 (`chore/stabilize-test-suite`)

### CI Pipeline Upgrade
- Upgraded GitHub Actions from Python 3.9 to Python 3.11
- Pinned lint tool versions: Ruff 0.9.10, Black 26.1.0
- Fixed CI lint and coverage failures

### Test Suite Fixes
- Fixed 22 failing integration tests by creating missing curvature tables in the test database
- Skipped route endpoint tests that depend on the unmounted `/routes/save` router
- Added `E402` to Ruff ignore list for intentional late imports in `server.py`

---

## January 30, 2026 - Vector Tiles & Docker Fixes

**PR**: #14 (`feature/load_all_us_states`)

### PostGIS Vector Tile Endpoint
- Added `GET /curvature/tiles/{z}/{x}/{y}.pbf` endpoint in `api/routers/tiles.py`
- Serves Mapbox Vector Tiles directly from PostGIS for scalable US-wide road rendering
- Zoom-based curvature filtering for performant tile generation
- Added `api/tile_math.py` for tile coordinate calculations
- Added `api/tests/unit/test_tile_math.py` and `api/tests/integration/test_tile_endpoint.py`

### Docker Fixes
- Fixed frontend container crash by removing read-only volume mount
- Updated TESTING_QUICKSTART.md to reflect current test suite

---

## January 22-29, 2026 - Docker Containerization

**PR**: #13 (`feature/load_all_us_states`)

### Docker Setup
- Added multi-stage Dockerfiles for API, frontend, and database (`docker/`)
  - API: Python 3.11, dev/prod/test stages
  - Frontend: Node.js 22-alpine, dev/prod stages with standalone build
  - Database: PostGIS 15-3.4 with initialization scripts
- Added `docker-compose.yml` for development (db, api, frontend services)
- Added `docker-compose.test.yml` for isolated test runs with tmpfs database
- Added `Makefile` with commands for development, testing, debugging, and production
- Added `.env.example` environment variable template

### Documentation Updates
- Updated API_README.md to reflect current architecture
- Removed outdated testing and API markdown files

### Frontend Improvements
- Fixed error handling and race conditions in frontend components

---

## January 2026 - PostGIS Architecture Refactor

**Commit**: `6159310` - "Refactor to PostGIS-backed viewport-based curvature viewer"

**PR**: #12 (`feature/full-us-map-load`)

This was the foundational change that transitioned B-Road from an in-memory route-building application to a scalable, database-backed curvature visualization platform.

### Backend API Refactor

#### Removed Components
- **api/routers/data.py** - In-memory msgpack data loading
- **api/routers/routes.py** - Route building and saving endpoints
- **api/routers/sessions.py** - Session management
- All route stitching business logic and database models

#### Added Components
- **api/routers/curvature.py** - PostGIS-based endpoints
  - `GET /curvature/segments` - Viewport-based segment queries
  - `GET /curvature/sources` - List available data sources
  - `GET /curvature/sources/{name}/segments` - Get all segments for a source
  - `GET /curvature/sources/{name}/bounds` - Get source bounding box
  - `GET /curvature/segments/{id}` - Get segment details

- **api/services/curvature_service.py** - Business logic layer
  - GeoJSON feature collection building
  - Curvature level classification
  - Coordinate transformations

- **api/repositories/curvature_repository.py** - Data access layer
  - PostGIS spatial queries with ST_Intersects
  - Bounding box filtering
  - Source-based filtering
  - Coordinate system transformations (900913 to 4326)

- **api/schema/curvature_indexes.sql** - Performance optimization
  - Spatial indexes on curvature_segments.geom
  - Indexes on foreign keys and commonly queried fields

- **api/tests/integration/test_curvature_api.py** - Comprehensive API tests
- **api/tests/fixtures/curvature_fixtures.py** - Test data fixtures

#### Architecture Pattern
- **Before**: Monolithic routers with mixed concerns
- **After**: Clean service/repository pattern with separation of concerns
  - Router: HTTP request/response handling
  - Service: Business logic and GeoJSON building
  - Repository: Database queries and spatial operations

---

### Frontend Complete Rewrite

#### Removed Features
- Route stitching/building UI
- Session management and persistence
- Saved routes library
- Route export functionality (KML/GPX)
- Segment selection and connection validation
- Route statistics tracking
- Dual-mode operation (Browse/Build)

#### New Features
- **Viewport-Based Loading**: Segments load automatically for visible map area
- **Zoom-Adaptive Filtering**: Minimum curvature increases at lower zoom levels
  - Zoom < 8: min_curvature = 1000, limit = 500
  - Zoom 8-10: min_curvature = 500, limit = 1000
  - Zoom > 10: min_curvature = 300, limit = 2000
- **State Filtering**: Dropdown to filter by US state/region
- **Simplified UI**: Focus on visualization rather than route building

#### Component Refactor

**frontend/app/page.tsx**
- Removed: Session initialization, route loading, segment click handlers
- Added: Simple config loading and Mapbox token initialization

**frontend/components/Map.tsx**
- Removed: Drawing tools, segment selection, route visualization
- Added: Viewport change detection, debounced data fetching, zoom-based filtering

**frontend/components/Sidebar.tsx**
- Removed: Data loading form, route builder, saved routes list
- Added: State selector, curvature filter, data status display, color legend

**frontend/store/useAppStore.ts**
- Removed: Route building state, selected segments, session management, saved routes
- Added: Curvature data, sources, viewport state, loading indicators

**frontend/lib/api.ts**
- Removed: Route CRUD operations, session management, segment loading
- Added: Bounding box queries, source listing, viewport-based segment fetching

**frontend/types/index.ts**
- Removed: SavedRoute, Segment, Session, AppMode types
- Added: CurvatureGeoJSON, SourceInfo, SourceBounds types

---

### Data Processing Updates

All curvature bin scripts updated to use modern msgpack API:
- **Before**: `msgpack.Unpacker(sys.stdin.buffer, use_list=True, encoding='utf-8')`
- **After**: `msgpack.Unpacker(sys.stdin.buffer, use_list=True, raw=False, strict_map_key=False)`

Updated scripts:
- bin/curvature-output-geojson
- bin/curvature-output-kml
- bin/curvature-output-kml-curve-radius
- bin/curvature-output-kml-surfaces
- bin/curvature-output-postgis
- bin/curvature-output-tab
- bin/curvature-pp
- bin/msgpack-reader

---

### Infrastructure Changes

#### Environment Configuration
- Added `.env` file support using python-dotenv
- Configuration loaded from api/.env:
  ```
  DATABASE_URL=postgresql://...
  MAPBOX_ACCESS_TOKEN=pk.ey...
  ```

#### .gitignore Updates
Added:
```
.env
.env.*
!.env.example
!.env.*.example
```

#### Server Initialization
**api/server.py** changes:
- Added dotenv loading at startup
- Removed route/session routers
- Added curvature router (conditionally mounted when database is available)
- Updated health check to remove in-memory data status

---

### Database Schema

The application uses the curvature project's native PostGIS schema:

#### Core Tables
- **curvature_segments**: Road segments with geometry (SRID 900913)
- **segment_ways**: OSM ways that comprise each segment
- **sources**: Data sources (typically US states)
- **tags**: Highway and surface type tags

#### Spatial Indexes
```sql
CREATE INDEX idx_curvature_segments_geom_gist
  ON curvature_segments USING GIST(geom);
CREATE INDEX idx_curvature_segments_curvature
  ON curvature_segments(curvature);
CREATE INDEX idx_curvature_segments_source
  ON curvature_segments(fk_source);
```

---

### Performance Improvements

#### Before (In-Memory)
- Entire dataset loaded into RAM
- 100-500MB memory usage per state
- Slow initial load times
- Limited scalability (single dataset at a time)

#### After (PostGIS)
- Data queried on-demand from database
- Minimal memory footprint
- Fast initial page load
- Unlimited scalability (query across multiple states)
- Spatial indexes enable sub-100ms query times

---

### Breaking Changes

#### API Endpoints Removed
- `POST /data/load`
- `POST /sessions/create`
- `GET /roads/geojson`
- `GET /roads`
- `GET /roads/segments`
- `POST /routes/save`
- `GET /routes/list`
- `GET /routes/{id}`
- `PUT /routes/{id}`
- `DELETE /routes/{id}`
- `GET /routes/{id}/export/gpx`
- `GET /routes/{id}/export/kml`

#### API Endpoints Added
- `GET /curvature/segments?bbox=w,s,e,n`
- `GET /curvature/sources`
- `GET /curvature/sources/{name}/segments`
- `GET /curvature/sources/{name}/bounds`
- `GET /curvature/segments/{id}`

---

## Future Roadmap

Features removed in the PostGIS refactor that may be re-implemented:

1. **Route Building**: Click segments to build custom routes
   - New implementation will use PostGIS spatial queries
   - Better connection validation using ST_Touches/ST_Intersects
   - Stored in new saved_routes table

2. **Export Functionality**: GPX/KML export of built routes
   - Generate from PostGIS geometry
   - Include elevation data from SRTM

3. **User Accounts**: Authentication and route sharing
   - Multi-user support with route privacy settings
   - Public route gallery
