# B-Road: Curvature API

A FastAPI + Next.js application for finding and exploring curvy roads, backed by PostGIS spatial data and rendered with Mapbox GL JS. The entire stack runs in Docker containers.

## Architecture

```
OSM PBF --> curvature pipeline --> msgpack --> bin/curvature-output-postgis --> PostGIS
                                                                                 |
                                                                     FastAPI (GeoJSON + MVT tiles)
                                                                                 |
                                                                         Mapbox GL JS (Next.js)
```

| Layer       | Technology                                              |
|-------------|---------------------------------------------------------|
| Frontend    | Next.js (TypeScript), Mapbox GL JS, Zustand, Tailwind CSS |
| Backend     | FastAPI (Python), SQLAlchemy ORM                        |
| Database    | PostgreSQL 15 with PostGIS 3.4                          |
| Development | Docker Compose (3 services: db, api, frontend)          |

The backend follows a layered architecture: **routers** (request handling) → **services** (business logic) → **repositories** (database queries).

## Quick Start

### Prerequisites

- Docker and Docker Compose
- A Mapbox access token (from https://account.mapbox.com/)
- Curvature data loaded into PostGIS (via `bin/curvature-output-postgis`)

### Setup

```bash
# 1. Copy the environment template and fill in your values
cp .env.example .env
# Edit .env -- set POSTGRES_PASSWORD and MAPBOX_ACCESS_TOKEN

# 2. Start all services
make up
# (or: docker compose up -d)

# 3. Verify everything is running
make health
```

Once running:

| Service  | URL                         |
|----------|-----------------------------|
| Frontend | http://localhost:3000        |
| API      | http://localhost:8000        |
| API Docs | http://localhost:8000/docs   |
| Database | localhost:5432               |

## Environment Variables

Defined in `.env` (see `.env.example` for the template):

| Variable              | Required | Default                  | Description                                |
|-----------------------|----------|--------------------------|--------------------------------------------|
| `POSTGRES_USER`       | No       | `curvature`              | PostgreSQL username                        |
| `POSTGRES_PASSWORD`   | Yes      |                          | PostgreSQL password                        |
| `DATABASE_URL`        | No       | constructed from above   | Full PostgreSQL connection string           |
| `MAPBOX_ACCESS_TOKEN` | Yes      |                          | Mapbox GL JS token for map rendering        |
| `NEXT_PUBLIC_API_URL` | No       | `http://localhost:8000`  | URL the frontend uses to reach the API      |

## API Endpoints

The API has three routers: **health** (no prefix), **curvature** (prefix `/curvature`), and **tiles** (prefix `/curvature/tiles`). Interactive documentation is available at `/docs` when the server is running.

---

### Health Router

Endpoints for status checks and frontend configuration. No authentication required.

#### `GET /`

Returns API info with a summary of available endpoints.

**Response:**
```json
{
  "name": "Curvature API",
  "version": "1.0.0",
  "endpoints": {
    "/curvature/segments": "Get curvature segments by bounding box",
    "/curvature/sources": "List available data sources",
    "/config": "Get frontend configuration",
    "/docs": "Interactive API documentation"
  }
}
```

#### `GET /health`

Health check endpoint. Reports whether the database connection is available.

**Response:**
```json
{
  "status": "healthy",
  "database_available": true
}
```

#### `GET /config`

Returns frontend configuration, including the Mapbox token read from the `MAPBOX_ACCESS_TOKEN` environment variable.

**Response (200):**
```json
{
  "mapbox_api_key": "pk.eyJ1Ijo...",
  "default_center": {"lat": 44.0, "lng": -72.7},
  "default_zoom": 8
}
```

**Response (500):** Returned when `MAPBOX_ACCESS_TOKEN` is not set.
```json
{
  "detail": "Mapbox API token not configured. Set MAPBOX_ACCESS_TOKEN environment variable."
}
```

---

### Curvature Router

All curvature endpoints are prefixed with `/curvature`. They require a healthy database connection.

#### `GET /curvature/segments`

Get road segments within a geographic bounding box. This is the primary endpoint used by the map viewport for loading visible roads.

**Query Parameters:**

| Parameter       | Type   | Required | Default | Constraints | Description                                         |
|-----------------|--------|----------|---------|-------------|-----------------------------------------------------|
| `bbox`          | string | Yes      |         |             | `"west,south,east,north"` in WGS84 (e.g., `"-73.5,42.7,-71.5,45.0"`) |
| `min_curvature` | int    | No       | 300     | >= 0        | Minimum curvature score to include                  |
| `limit`         | int    | No       | 1000    | 1 -- 5000   | Maximum number of segments to return                |
| `source`        | string | No       |         |             | Filter by source name (e.g., `"vermont"`)           |

**Zoom-based filtering hints** (recommended values for the frontend):

| Zoom Level | `min_curvature` | `limit` |
|------------|-----------------|---------|
| < 8        | 1000            | 500     |
| 8 -- 10    | 500             | 1000    |
| > 10       | 300             | 2000    |

**Response (200):**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "42",
      "geometry": {
        "type": "LineString",
        "coordinates": [[-72.8, 44.2], [-72.7, 44.3]]
      },
      "properties": {
        "id": 42,
        "id_hash": "abc123def456",
        "name": "Route 100",
        "curvature": 1250.5,
        "curvature_level": "engaging",
        "length": 25300,
        "length_km": 25.3,
        "length_mi": 15.72,
        "paved": true,
        "surface": "paved",
        "source": "vermont"
      }
    }
  ],
  "metadata": {
    "count": 1
  }
}
```

**Errors:**
- `400` -- Invalid bbox format, non-numeric values, or west >= east / south >= north
- `500` -- Database query failure

#### `GET /curvature/sources`

List all available data sources (typically US states) with their segment counts.

**Response (200):**
```json
[
  {"id": 1, "name": "vermont", "segment_count": 4523},
  {"id": 2, "name": "new_hampshire", "segment_count": 3871}
]
```

#### `GET /curvature/sources/{source_name}/segments`

Get all segments for a specific source without bounding box filtering. Useful for loading an entire state at once.

**Path Parameters:**

| Parameter     | Type   | Description                           |
|---------------|--------|---------------------------------------|
| `source_name` | string | Source name (e.g., `"vermont"`)       |

**Query Parameters:**

| Parameter       | Type | Required | Default | Constraints | Description                        |
|-----------------|------|----------|---------|-------------|------------------------------------|
| `min_curvature` | int  | No       | 300     | >= 0        | Minimum curvature score to include |
| `limit`         | int  | No       | 1000    | 1 -- 5000   | Maximum number of segments         |

**Response (200):** GeoJSON FeatureCollection (same structure as `/curvature/segments`).

#### `GET /curvature/sources/{source_name}/bounds`

Get the geographic bounding box enclosing all segments from a source. Useful for centering and zooming the map to a state.

**Path Parameters:**

| Parameter     | Type   | Description                           |
|---------------|--------|---------------------------------------|
| `source_name` | string | Source name (e.g., `"vermont"`)       |

**Response (200):**
```json
{
  "west": -73.43,
  "south": 42.73,
  "east": -71.46,
  "north": 45.02
}
```

**Errors:**
- `404` -- Source not found or has no segments

#### `GET /curvature/segments/{segment_id}`

Get detailed information about a single segment, including its constituent OSM ways and their tags.

**Path Parameters:**

| Parameter    | Type | Description         |
|--------------|------|---------------------|
| `segment_id` | int  | The segment ID      |

**Response (200):**
```json
{
  "id": 42,
  "id_hash": "abc123def456",
  "name": "Route 100",
  "curvature": 1250.5,
  "length": 25300,
  "length_km": 25.3,
  "length_mi": 15.72,
  "paved": true,
  "source": "vermont",
  "geometry": {
    "type": "LineString",
    "coordinates": [[-72.8, 44.2], [-72.7, 44.3]]
  },
  "ways": [
    {
      "way_id": 98765,
      "position": 0,
      "name": "Route 100",
      "curvature": 620.3,
      "length": 12500,
      "bbox": {
        "min_lon": -72.85,
        "max_lon": -72.75,
        "min_lat": 44.18,
        "max_lat": 44.28
      },
      "highway": "secondary",
      "surface": "asphalt"
    }
  ]
}
```

**Errors:**
- `404` -- Segment not found

---

### Tiles Router

Vector tile endpoints for efficient map rendering. The frontend uses these tiles instead of GeoJSON for viewport-based loading.

#### `GET /curvature/tiles/{z}/{x}/{y}.pbf`

Get a Mapbox Vector Tile (MVT) for the given ZXY slippy map coordinates. Returns protobuf-encoded binary data that Mapbox GL JS renders natively.

**Path Parameters:**

| Parameter | Type | Description                        |
|-----------|------|------------------------------------|
| `z`       | int  | Zoom level (0--22)                 |
| `x`       | int  | Tile column (0 to 2^z - 1)        |
| `y`       | int  | Tile row (0 to 2^z - 1)           |

**Query Parameters:**

| Parameter | Type   | Required | Description                                  |
|-----------|--------|----------|----------------------------------------------|
| `source`  | string | No       | Filter by source name (e.g., `"vermont"`)    |

**Zoom-based curvature filtering** (applied automatically by the server):

| Zoom Level | Min Curvature |
|------------|---------------|
| < 8        | 1000          |
| 8 -- 10    | 500           |
| > 10       | 300           |

**Response (200):** Binary protobuf (`application/x-protobuf`) with `Cache-Control: public, max-age=3600`.

The tile contains a layer named `curvature` with these properties per feature:

| Property      | Type    | Description                        |
|---------------|---------|------------------------------------|
| `id`          | int     | Segment database ID                |
| `name`        | string  | Road name                          |
| `curvature`   | float   | Curvature score                    |
| `length`      | float   | Length in meters                   |
| `paved`       | boolean | Whether the road is paved          |
| `source_name` | string  | Data source name                   |

**Response (204):** Empty tile (no data in this area). `Cache-Control: public, max-age=86400`.

**Errors:**
- `400` -- Invalid zoom level or tile coordinates out of range

**Example:**
```bash
# Get a tile covering Vermont area
curl http://localhost:8000/curvature/tiles/8/74/93.pbf -o tile.pbf

# Check headers
curl -I http://localhost:8000/curvature/tiles/8/74/93.pbf

# Filter by source
curl "http://localhost:8000/curvature/tiles/8/74/93.pbf?source=vermont" -o tile.pbf
```

---

### GeoJSON Feature Properties

Every feature returned in a FeatureCollection includes these properties:

| Property          | Type    | Description                                |
|-------------------|---------|--------------------------------------------|
| `id`              | int     | Segment database ID                        |
| `id_hash`         | string  | SHA1 hash for deduplication                |
| `name`            | string  | Road name (or "Unnamed Road")              |
| `curvature`       | float   | Curvature score                            |
| `curvature_level` | string  | Category: relaxed, spirited, engaging, technical, expert, legendary |
| `length`          | float   | Length in meters                            |
| `length_km`       | float   | Length in kilometers                        |
| `length_mi`       | float   | Length in miles                             |
| `paved`           | boolean | Whether the road is paved                  |
| `surface`         | string  | "paved" or "unpaved"                       |
| `source`          | string  | Data source name (e.g., "vermont")         |

**Road Rating levels:**

| Level        | Curvature Score |
|--------------|-----------------|
| `relaxed`    | 300 -- 599      |
| `spirited`   | 600 -- 999      |
| `engaging`   | 1000 -- 1999    |
| `technical`  | 2000 -- 4999    |
| `expert`     | 5000 -- 9999    |
| `legendary`  | 10000+          |

## Frontend Map Rendering

The Next.js frontend renders segments on a Mapbox GL JS map using **vector tiles** served from PostGIS via `ST_AsMVT`. The map is centered on the US (`-98.5, 39.8`, zoom 5) and loads tiles from `/curvature/tiles/{z}/{x}/{y}.pbf`.

Road segments are color-coded by road rating:

| Curvature Score | Rating    | Color       | Hex       |
|-----------------|-----------|-------------|-----------|
| 300 -- 599      | Relaxed   | Green       | `#4CAF50` |
| 600 -- 999      | Spirited  | Light Green | `#8BC34A` |
| 1000 -- 1999    | Engaging  | Yellow      | `#FFEB3B` |
| 2000 -- 4999    | Technical | Orange      | `#FF9800` |
| 5000 -- 9999    | Expert    | Red         | `#F44336` |
| 10000+          | Legendary | Purple      | `#9C27B0` |

Line width scales with zoom level: z4 = 1px, z8 = 2px, z12 = 4px.

The frontend applies two client-side interactions without network requests:
- **Source filter:** Selecting a state in the sidebar updates the tile URL with `?source=X` and clears the tile cache.
- **Curvature slider:** Adjusting the minimum curvature applies a Mapbox GL filter expression instantly on already-loaded tiles.

## Usage Examples

### Command Line (curl)

**Check health:**
```bash
curl http://localhost:8000/health
```

**Get frontend config:**
```bash
curl http://localhost:8000/config
```

**List available sources (states):**
```bash
curl http://localhost:8000/curvature/sources
```

**Get curvy roads in a bounding box:**
```bash
curl "http://localhost:8000/curvature/segments?bbox=-73.5,42.7,-71.5,45.0&min_curvature=1000&limit=50"
```

**Get all segments for Vermont:**
```bash
curl "http://localhost:8000/curvature/sources/vermont/segments?min_curvature=500&limit=100"
```

**Get bounds for a state:**
```bash
curl http://localhost:8000/curvature/sources/vermont/bounds
```

**Get segment detail:**
```bash
curl http://localhost:8000/curvature/segments/42
```

**Get a vector tile (binary protobuf):**
```bash
curl http://localhost:8000/curvature/tiles/8/74/93.pbf -o tile.pbf
```

**Check tile headers:**
```bash
curl -I http://localhost:8000/curvature/tiles/8/74/93.pbf
```

### Python

```python
import requests

BASE = "http://localhost:8000"

# Check API health
health = requests.get(f"{BASE}/health")
print(health.json())
# {"status": "healthy", "database_available": true}

# List available sources
sources = requests.get(f"{BASE}/curvature/sources")
for src in sources.json():
    print(f"  {src['name']}: {src['segment_count']} segments")

# Get curvy roads in a bounding box
segments = requests.get(
    f"{BASE}/curvature/segments",
    params={
        "bbox": "-73.5,42.7,-71.5,45.0",
        "min_curvature": 1000,
        "limit": 50,
    },
)
geojson = segments.json()
print(f"Found {geojson['metadata']['count']} segments")

for feature in geojson["features"]:
    props = feature["properties"]
    print(f"  {props['name']}: curvature={props['curvature']}, "
          f"length={props['length_mi']}mi ({props['curvature_level']})")

# Get segment detail with OSM ways
detail = requests.get(f"{BASE}/curvature/segments/42")
if detail.status_code == 200:
    seg = detail.json()
    print(f"\n{seg['name']} - {len(seg['ways'])} ways")
    for way in seg["ways"]:
        print(f"  Way {way['way_id']}: {way['highway']} / {way['surface']}")
```

## Database

### Curvature Data Tables

The curvature processing pipeline (`bin/curvature-output-postgis`) loads OSM data into these PostGIS tables:

| Table                  | Description                                            |
|------------------------|--------------------------------------------------------|
| `curvature_segments`   | Road segments with LINESTRING geometry, curvature scores, length, and paved status |
| `sources`              | Data source metadata (state names)                     |
| `segment_ways`         | Constituent OSM ways per segment                       |
| `tags`                 | OSM tags (highway type, surface type, etc.)            |

Performance indexes are defined in `api/schema/curvature_indexes.sql`:
- Spatial GIST index on segment geometry
- Curvature descending index (for "curviest first" ordering)
- Composite source + curvature index
- Partial indexes for high-curvature and paved-only queries
- Hash index on `id_hash` for deduplication lookups
- Partial GIST indexes for vector tile queries (curvature >= 300 and >= 1000)

### Saved Routes Schema (Not Currently Active)

The schema at `api/schema/saved_routes.sql` defines tables for a route stitching feature (`route_sessions`, `saved_routes`, `route_segments`). This schema exists in the database but the corresponding API endpoints are **not currently mounted** in the application.

## Docker Services

Defined in `docker-compose.yml`:

| Service    | Container Name     | Image / Build              | Port | Health Check                   |
|------------|--------------------|----------------------------|------|--------------------------------|
| `db`       | `b-road-db`        | `postgis/postgis:15-3.4-alpine` | 5432 | `pg_isready`                   |
| `api`      | `b-road-api`       | `docker/api/Dockerfile`     | 8000 | `curl http://localhost:8000/health` |
| `frontend` | `b-road-frontend`  | `docker/frontend/Dockerfile`| 3000 | `wget http://localhost:3000`   |

Dependency chain: `frontend` --> `api` (healthy) --> `db` (healthy).

Named volumes: `b-road-postgres-data`, `b-road-api-cache`, `b-road-next-cache`.

## Makefile Commands

Run `make help` for the full list. Summary:

**Development:**
```
make up              Start development environment
make down            Stop development environment
make build           Build Docker images
make rebuild         Force rebuild (no cache)
make logs            Tail logs from all services
make logs-api        Tail API logs only
make logs-frontend   Tail frontend logs only
make logs-db         Tail database logs only
```

**Testing:**
```
make test            Run API tests
make lint            Run linters (flake8 + eslint)
make coverage        Run tests with coverage report
```

**Debugging:**
```
make shell-api       Open bash shell in API container
make shell-db        Open psql shell in database container
make shell-frontend  Open shell in frontend container
make health          Check health of all services
```

**Production:**
```
make prod-build      Build production images
make prod-up         Start production environment
make prod-down       Stop production environment
```

**Maintenance:**
```
make clean           Remove containers, volumes, and images
make clean-volumes   Remove only Docker volumes
```

## Testing

- **Framework:** pytest with pytest-asyncio
- **Run via Docker:** `make test` or `make coverage`
- **Test database:** `curvature_test` with PostGIS extension

Coverage reports are generated in `htmlcov/` when running `make coverage`.

## Troubleshooting

### Services Not Starting

```bash
# Check container status
docker compose ps

# Check logs for errors
make logs

# Verify environment variables are set
cat .env
```

### Database Connection Issues

```bash
# Open a psql shell in the database container
make shell-db

# Check PostGIS is available
SELECT PostGIS_Version();

# Check segment count
SELECT COUNT(*) FROM curvature_segments;
```

### Map Not Loading

1. Verify `MAPBOX_ACCESS_TOKEN` is set in `.env`
2. Check `GET /config` returns a valid token: `curl http://localhost:8000/config`
3. Check the browser console for Mapbox errors
4. Verify the token has the correct scopes at https://account.mapbox.com/

### No Roads Appearing on Map

1. Check that curvature data has been loaded: `curl http://localhost:8000/curvature/sources`
2. If sources list is empty, load data using `bin/curvature-output-postgis`
3. Try a broader bounding box or lower `min_curvature` value
4. Check API logs: `make logs-api`

## License

This code extends the adamfranco/curvature project. Please refer to the main project's license.

## Contributing

Contributions welcome. Please ensure:

- Code follows existing patterns and style
- Tests pass (`make test`)
- API documentation is updated for endpoint changes
- Database schema changes include migration scripts
