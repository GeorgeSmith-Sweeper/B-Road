# Quick Reference: B-Road

## What Is B-Road?

B-Road is a database-backed curvature visualization platform. It loads OpenStreetMap road data into PostGIS, scores roads by curvature, and displays them on an interactive Mapbox map with color-coded curvature levels.

## Architecture Overview

```
OSM Data (.osm.pbf)
  → Curvature processing pipeline
    → PostGIS database (curvature_segments table)
      → FastAPI backend (REST + Vector Tiles)
        → Next.js frontend (Mapbox GL JS)
```

## Project Structure

```
B-Road/
├── api/                        # FastAPI backend
│   ├── server.py               # App entry point
│   ├── routers/
│   │   ├── health.py           # Health check & config
│   │   ├── curvature.py        # Curvature data endpoints
│   │   └── tiles.py            # Mapbox Vector Tile endpoint
│   ├── services/               # Business logic layer
│   ├── repositories/           # PostGIS query layer
│   ├── models/                 # SQLAlchemy ORM models
│   ├── schema/                 # SQL schema & indexes
│   ├── tests/                  # Unit + integration tests
│   ├── requirements.txt        # Python dependencies
│   └── requirements-dev.txt    # Dev/test dependencies
├── frontend/                   # Next.js React frontend
│   ├── app/
│   │   ├── page.tsx            # Main page + initialization
│   │   └── layout.tsx          # App layout + metadata
│   ├── components/
│   │   ├── Map.tsx             # Mapbox map + vector tiles
│   │   └── Sidebar.tsx         # State selector + curvature filter
│   ├── store/
│   │   └── useAppStore.ts      # Zustand state management
│   ├── lib/
│   │   └── api.ts              # API client (axios)
│   └── types/
│       └── index.ts            # TypeScript definitions
├── docker/                     # Dockerfiles (api, frontend, db)
├── .github/workflows/          # CI/CD pipeline
├── curvature/                  # Curvature processing modules
├── processing_chains/          # OSM data processing scripts
├── docker-compose.yml          # Development environment
├── docker-compose.test.yml     # Test environment
├── Makefile                    # Common Docker commands
└── .env.example                # Environment variable template
```

## Key Commands

### Docker (recommended)

```bash
# Start everything (database, API, frontend)
make up

# Check service health
make health

# View logs
make logs

# Stop everything
make down

# Run tests
make test

# Run linters
make lint

# Open shells
make shell-api
make shell-db
make shell-frontend
```

### Manual (without Docker)

```bash
# Backend
cd api
pip install -r requirements.txt
uvicorn server:app --reload        # http://localhost:8000

# Frontend
cd frontend
npm install
npm run dev                        # http://localhost:3000
```

## API Endpoints

### Health Router (always mounted)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | API info |
| `/health` | GET | Health check (database status) |
| `/config` | GET | Frontend config (Mapbox token, default center/zoom) |

### Curvature Router (requires database)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/curvature/segments?bbox=w,s,e,n` | GET | Segments in viewport bounding box |
| `/curvature/sources` | GET | List available data sources (states) |
| `/curvature/sources/{name}/segments` | GET | All segments for a source |
| `/curvature/sources/{name}/bounds` | GET | Geographic bounds of a source |
| `/curvature/segments/{id}` | GET | Single segment details |

### Tiles Router (requires database)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/curvature/tiles/{z}/{x}/{y}.pbf` | GET | Mapbox Vector Tiles with zoom-based filtering |

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

```bash
POSTGRES_USER=curvature
POSTGRES_PASSWORD=your_secure_password_here
DATABASE_URL=postgresql://curvature:your_secure_password_here@db:5432/curvature
MAPBOX_ACCESS_TOKEN=your_mapbox_token_here    # Get from https://account.mapbox.com/
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Curvature Color Legend

- Yellow: 0-600 (pleasant, flowing roads)
- Orange: 600-1000 (fun, moderately twisty)
- Red: 1000-2000 (very curvy, technical roads)
- Purple: 2000+ (extremely twisty)

## Zoom-Adaptive Filtering

The frontend adjusts curvature filtering based on zoom level to keep the map performant:

| Zoom Level | Min Curvature | Segment Limit |
|------------|---------------|---------------|
| < 8 | 1000 | 500 |
| 8-10 | 500 | 1,000 |
| > 10 | 300 | 2,000 |

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript 5 |
| Map | Mapbox GL JS v3 |
| State Management | Zustand |
| Styling | Tailwind CSS 4 |
| Backend | FastAPI, Python 3.11 |
| Database | PostgreSQL 15 + PostGIS 3.4 |
| Containers | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Linting | Ruff, Black (Python); ESLint (TypeScript) |
| Testing | pytest, pytest-cov (60% minimum coverage) |

## Data Processing

Load OSM data into PostGIS:

```bash
# Process OSM data through the curvature pipeline and load into PostGIS
./processing_chains/adams_default.sh state.osm.pbf state | \
  ./bin/curvature-output-postgis --source state
```

## Common Issues

### Map won't load
- Check backend is running: `curl http://localhost:8000/config`
- Verify `MAPBOX_ACCESS_TOKEN` is set in `.env`

### No roads displaying
- Ensure PostGIS data is loaded (`curl http://localhost:8000/curvature/sources`)
- Try zooming in (higher zoom shows lower-curvature roads)
- Check browser console for errors

### Database not connecting
- Verify PostgreSQL is running with PostGIS extension
- Check `DATABASE_URL` in `.env`
- Run `make health` to diagnose

### Build errors
- Delete `node_modules` and `package-lock.json`, run `npm install`
- Clear Next.js cache: `rm -rf .next`
- Rebuild Docker: `make rebuild`

## Documentation

- **README.md**: Project overview and quick start
- **API_README.md**: Detailed API and architecture documentation
- **changes.md**: Change history
- **setup_guide.md**: Detailed setup instructions
- **quick_reference.md**: This file
