# B-Road: Curvature Road Viewer

B-Road is a simplified web application for visualizing curvy roads from [adamfranco/curvature](https://github.com/adamfranco/curvature) data. Load any region's processed msgpack file and explore the twistiest roads on an interactive Mapbox map.

## What Changed (v2.0)

This version is a **major simplification** of the previous B-Road application:

### Removed
- PostgreSQL/PostGIS database dependency
- Route stitching and building features
- Session management
- Route saving and exporting (KML/GPX)
- Google Maps (replaced with Mapbox)

### Kept
- Curvature data loading from msgpack files
- Road filtering by curvature and surface type
- Interactive map visualization with curvature-based coloring
- Click-to-view road details

### Why Simplify?
The previous version added significant complexity (database, sessions, route building) that made the application harder to maintain and deploy. This simplified version focuses on the core use case: **visualizing curvy roads on a map**.

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- Mapbox API key ([get one here](https://account.mapbox.com/access-tokens/))

### Installation

1. **Clone and setup backend**:
```bash
git clone https://github.com/GeorgeSmith-Sweeper/B-Road.git
cd B-Road
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. **Configure Mapbox token**:
```bash
# Create api/config.py with your token
echo 'MAPBOX_ACCESS_TOKEN = "your_token_here"' > api/config.py
```

3. **Setup frontend**:
```bash
cd frontend
npm install
```

4. **Process OSM data** (or use existing msgpack files):
```bash
# Download a small region (e.g., Monaco)
curl -L -o monaco.osm.pbf "https://download.geofabrik.de/europe/monaco-latest.osm.pbf"

# Process through curvature pipeline
./processing_chains/adams_default.sh -v -t /tmp -o . monaco.osm.pbf
```

### Running

**Terminal 1 - Backend**:
```bash
source venv/bin/activate
uvicorn api.server:app --reload --port 8000
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
```

Open http://localhost:3000

## Usage

1. Enter the path to a `.msgpack` file (e.g., `/path/to/monaco.msgpack`)
2. Click **Load Data**
3. Adjust filters (minimum curvature, surface type, max results)
4. Click **Search Roads**
5. Click on roads to see details (name, curvature, length, surface)

## Curvature Legend

| Color | Curvature | Description |
|-------|-----------|-------------|
| Yellow | 300-600 | Pleasant curves |
| Orange | 600-1000 | Moderately twisty |
| Red | 1000-2000 | Very curvy |
| Purple | 2000+ | Extremely twisty |

## Tech Stack

**Backend**:
- FastAPI (Python)
- No database required

**Frontend**:
- Next.js 16
- Mapbox GL JS
- Zustand (state management)
- Tailwind CSS

**Data Processing**:
- Curvature tools (from adamfranco/curvature)
- PyOsmium for OSM parsing
- MessagePack for data serialization

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/config` | GET | Get Mapbox token and defaults |
| `/health` | GET | Health check |
| `/data/load?filepath=...` | POST | Load a msgpack file |
| `/roads/geojson` | GET | Get filtered roads as GeoJSON |

## Project Structure

```
B-Road/
├── api/
│   ├── server.py           # FastAPI application
│   ├── routers/
│   │   ├── data.py         # Data loading endpoints
│   │   └── health.py       # Health/config endpoints
│   └── services/
│       ├── data_service.py     # Msgpack loading/filtering
│       └── geometry_service.py # GeoJSON conversion
├── frontend/
│   ├── app/page.tsx        # Main page
│   ├── components/
│   │   ├── Map.tsx         # Mapbox map
│   │   └── Sidebar.tsx     # Filters UI
│   ├── lib/api.ts          # API client
│   ├── store/useAppStore.ts # Zustand store
│   └── types/index.ts      # TypeScript types
├── curvature/              # Original curvature library
├── processing_chains/      # OSM processing scripts
└── bin/                    # Curvature CLI tools
```

## License

This project inherits the license from [adamfranco/curvature](https://github.com/adamfranco/curvature).

## Acknowledgments

- **Adam Franco** - Original [curvature](https://github.com/adamfranco/curvature) project
- **OpenStreetMap Contributors** - Map data
- Built with assistance from [Claude Code](https://claude.ai/code)
