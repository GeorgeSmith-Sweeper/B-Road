# B-Road Setup Guide

## Prerequisites

- **Docker & Docker Compose** (recommended) OR:
  - Python 3.11+
  - Node.js 18+
  - PostgreSQL 15+ with PostGIS 3.4+
- **Mapbox account** - Free token from https://account.mapbox.com/

## Option 1: Docker Setup (Recommended)

Docker handles the database, API, and frontend in one command.

### 1. Clone and Configure

```bash
git clone <repository-url>
cd B-Road

# Create environment file from template
cp .env.example .env
```

Edit `.env` with your values:

```bash
POSTGRES_USER=curvature
POSTGRES_PASSWORD=your_secure_password_here
DATABASE_URL=postgresql://curvature:your_secure_password_here@db:5432/curvature
MAPBOX_ACCESS_TOKEN=pk.eyJ...your_token_here
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 2. Start Services

```bash
make up
```

This starts three containers:
- **db** - PostgreSQL 15 with PostGIS on port 5432
- **api** - FastAPI backend on port 8000
- **frontend** - Next.js app on port 3000

### 3. Verify Health

```bash
make health
```

All three services should report healthy. You can also check individually:

```bash
curl http://localhost:8000/health    # API health check
curl http://localhost:8000/config    # Should return Mapbox token
```

### 4. Load Data

Process OpenStreetMap data and load it into PostGIS:

```bash
# Process a state's OSM data through the curvature pipeline
./processing_chains/adams_default.sh vermont.osm.pbf vermont | \
  ./bin/curvature-output-postgis --source vermont
```

Verify data loaded:

```bash
curl http://localhost:8000/curvature/sources
```

### 5. Open the App

Navigate to http://localhost:3000. The map should display with curvature data visible when you zoom into areas with loaded data.

---

## Option 2: Manual Setup (Without Docker)

### 1. Database Setup

Install PostgreSQL with PostGIS, then create the database:

```bash
createdb curvature
psql curvature -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Load schema
psql curvature < api/schema/curvature.sql

# Add performance indexes
psql curvature < api/schema/curvature_indexes.sql
```

### 2. Backend Setup

```bash
cd api

# Create and activate virtual environment
python -m venv ../venv
source ../venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env <<EOF
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/curvature
MAPBOX_ACCESS_TOKEN=pk.eyJ...your_token_here
EOF

# Start the server
uvicorn server:app --reload
```

The API will be available at http://localhost:8000.

Note: The curvature and tiles routers mount conditionally. If the database is not reachable, only the health router will be available. Check `http://localhost:8000/health` to verify database connectivity.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Start development server
npm run dev
```

The frontend will be available at http://localhost:3000.

### 4. Load Data

Same as Docker setup -- process OSM data and pipe it to `curvature-output-postgis`:

```bash
./processing_chains/adams_default.sh state.osm.pbf state | \
  ./bin/curvature-output-postgis --source state
```

---

## Using the Application

### Map Exploration

1. Open http://localhost:3000
2. The map loads centered on the default location
3. Pan and zoom to areas where you've loaded data
4. Roads appear color-coded by curvature:
   - **Yellow**: 0-600 (pleasant, flowing roads)
   - **Orange**: 600-1000 (fun, moderately twisty)
   - **Red**: 1000-2000 (very curvy, technical roads)
   - **Purple**: 2000+ (extremely twisty)

### Sidebar Controls

- **State selector**: Filter by a specific data source / state
- **Curvature filter**: Adjust the minimum curvature threshold

### Viewport-Based Loading

Segments load automatically based on the visible map area. The system adapts filtering to the zoom level:

| Zoom Level | Min Curvature | Segment Limit |
|------------|---------------|---------------|
| < 8 | 1000 | 500 |
| 8-10 | 500 | 1,000 |
| > 10 | 300 | 2,000 |

Zoom in to see more roads with lower curvature scores.

---

## Running Tests

### With Docker

```bash
# Run full test suite
make test

# Run with coverage report
make coverage

# Run linters
make lint
```

### Without Docker

```bash
cd api

# Install test dependencies
pip install -r requirements-dev.txt

# Run tests (requires PostgreSQL with PostGIS)
pytest

# Run with coverage
pytest --cov --cov-report=term-missing

# Run specific test categories
pytest tests/unit/
pytest tests/integration/
pytest -m unit
pytest -m integration
```

The CI pipeline enforces 60% minimum code coverage.

---

## Troubleshooting

### Map Not Loading

**Problem:** Map shows a loading state or blank screen.

**Solutions:**
1. Check the API is running: `curl http://localhost:8000/config`
2. Verify `MAPBOX_ACCESS_TOKEN` is set and starts with `pk.`
3. Check browser console for errors
4. Verify CORS is working (API allows all origins in dev mode)

### No Roads Appearing

**Problem:** Map loads but no road segments are visible.

**Solutions:**
1. Verify data is loaded: `curl http://localhost:8000/curvature/sources`
2. Zoom into an area where data exists
3. Lower the curvature threshold in the sidebar
4. Check the vector tile endpoint: `curl http://localhost:8000/curvature/tiles/10/300/375.pbf`

### Database Not Connecting

**Problem:** `/health` reports database as unhealthy.

**Solutions:**
1. Check PostgreSQL is running with PostGIS extension
2. Verify `DATABASE_URL` in your `.env` file
3. With Docker: `make health` and `make logs-db`
4. Without Docker: `psql -d curvature -c "SELECT PostGIS_version();"`

### Docker Issues

**Problem:** Containers failing to start.

**Solutions:**
1. Check logs: `make logs`
2. Rebuild images: `make rebuild`
3. Reset everything: `make clean` then `make up`
4. Verify `.env` file exists and has required variables

### Build Errors (Frontend)

**Problem:** TypeScript or build errors.

**Solutions:**
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Clear Next.js cache: `rm -rf .next`
4. Run `npm run build` to see detailed errors

### CI Pipeline Failures

**Problem:** GitHub Actions tests or lint failing.

**Solutions:**
1. Run linters locally: `ruff check . --ignore E501,F401,E402` and `black --check --diff .`
2. Run tests locally to reproduce: `pytest --cov`
3. Check that coverage is above 60%

---

## Service Ports

| Service | Port | URL |
|---------|------|-----|
| PostgreSQL | 5432 | `postgresql://localhost:5432/curvature` |
| FastAPI | 8000 | http://localhost:8000 |
| Frontend | 3000 | http://localhost:3000 |
| Test DB | 5433 | (only during `make test`) |

## Useful Makefile Commands

| Command | Description |
|---------|-------------|
| `make up` | Start development environment |
| `make down` | Stop development environment |
| `make build` | Build Docker images |
| `make rebuild` | Force rebuild (no cache) |
| `make logs` | View all service logs |
| `make logs-api` | View API logs only |
| `make logs-frontend` | View frontend logs only |
| `make logs-db` | View database logs only |
| `make test` | Run API tests |
| `make lint` | Run linters |
| `make coverage` | Run tests with coverage |
| `make shell-api` | Shell into API container |
| `make shell-db` | psql shell into database |
| `make shell-frontend` | Shell into frontend container |
| `make health` | Check all service health |
| `make clean` | Remove containers, volumes, images |

---

## Next Steps

Once everything is running:

1. Load data for the states/regions you're interested in
2. Explore the map and verify curvature coloring
3. Check out the API documentation in **API_README.md**
4. See **quick_reference.md** for a condensed cheat sheet
