# Curvature API with Route Stitching

A FastAPI-based REST API for the Curvature road analysis tool, with added functionality for building, saving, and sharing custom routes.

## Features

### Browse Mode (Original Functionality)
- Load and analyze curvy roads from OpenStreetMap data
- Filter roads by curvature score, surface type, and length
- Display roads on an interactive Google Maps interface
- View detailed road statistics

### Route Stitching Mode (New Feature)
- **Manual Route Building**: Click road segments on the map to build custom routes
- **Segment Validation**: Automatically validates that segments connect end-to-end
- **Real-time Statistics**: See distance and curvature totals as you build
- **Save Routes**: Store routes in PostgreSQL/PostGIS database
- **Export**: Download routes as KML (Google Earth) or GPX (GPS devices)
- **Share Routes**: Generate shareable URLs for your routes
- **Session Management**: Routes persist across browser sessions

## Quick Start

### Prerequisites

- Python 3.7+
- PostgreSQL with PostGIS extension
- Google Maps API key
- Curvature msgpack data files (generated from OSM data)

### Installation

1. **Install Python dependencies**:
```bash
cd api
pip install -r requirements.txt
```

2. **Set up PostgreSQL database**:
```bash
# Create database
createdb curvature

# Enable PostGIS
psql curvature -c "CREATE EXTENSION postgis;"

# Run schema (if using existing curvature tables)
psql curvature < ../output-master/curvature.sql

# Run route stitching schema
psql curvature < schema/saved_routes.sql
```

3. **Configure API keys**:
```bash
# Copy example config
cp config.example.py config.py

# Edit config.py and add your Google Maps API key
# DATABASE_URL = "postgresql://user:password@localhost:5432/curvature"
```

4. **Start the server**:
```bash
python server.py
```

The API will be available at http://localhost:8000

### Web Interface

Open http://localhost:8000/static/index.html in your browser.

## API Endpoints

### Configuration

#### GET /config
Get frontend configuration including Google Maps API key.

**Response**:
```json
{
  "google_maps_api_key": "your_key_here",
  "default_center": {"lat": 44.0, "lng": -72.7},
  "default_zoom": 8
}
```

### Data Loading (Browse Mode)

#### POST /data/load
Load a curvature msgpack file into memory.

**Query Parameters**:
- `filepath`: Path to .msgpack file

**Response**:
```json
{
  "status": "success",
  "message": "Loaded 150 road collections",
  "filepath": "/tmp/vermont.msgpack"
}
```

#### GET /roads/geojson
Get roads as GeoJSON FeatureCollection.

**Query Parameters**:
- `min_curvature`: Minimum curvature score (default: 300)
- `max_curvature`: Maximum curvature score (optional)
- `surface`: Surface type - paved, unpaved, or unknown (optional)
- `limit`: Max number of roads (default: 100)

**Response**:
```json
{
  "type": "FeatureCollection",
  "features": [...],
  "metadata": {
    "total_collections": 500,
    "filtered_count": 100,
    "filters": {...}
  }
}
```

#### GET /roads
Search for roads (simplified JSON format).

**Response**:
```json
{
  "total_found": 50,
  "roads": [
    {
      "name": "VT Route 100",
      "curvature": 1250.5,
      "length_km": 25.3,
      "length_mi": 15.7,
      "surface": "paved"
    }
  ]
}
```

### Route Stitching (New Endpoints)

#### POST /sessions/create
Create a new user session for route building.

**Query Parameters** (optional):
- `session_name`: Friendly name for the session

**Response**:
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2024-01-07T12:00:00"
}
```

#### GET /roads/segments
Get individual road segments for stitching mode (more granular than /roads/geojson).

**Query Parameters**:
- `min_curvature`: Minimum curvature for parent collection (default: 300)
- `bbox`: Bounding box filter (optional): "min_lon,min_lat,max_lon,max_lat"
- `limit`: Max number of segments (default: 500)

**Response**:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "12345-0",
      "geometry": {
        "type": "LineString",
        "coordinates": [...]
      },
      "properties": {
        "way_id": 12345,
        "segment_index": 0,
        "start": [44.5, -73.2],
        "end": [44.51, -73.21],
        "length": 120.5,
        "radius": 85.3,
        "curvature": 156.7,
        "curvature_level": 2,
        "name": "Main Street",
        "highway": "primary",
        "surface": "asphalt"
      }
    }
  ]
}
```

#### POST /routes/save
Save a stitched route to the database.

**Query Parameters**:
- `session_id`: User session ID (required)

**Request Body**:
```json
{
  "route_name": "My Favorite Loop",
  "description": "Great weekend ride through the mountains",
  "segments": [
    {
      "way_id": 12345,
      "start": [44.5, -73.2],
      "end": [44.51, -73.21],
      "length": 120.5,
      "radius": 85.3,
      "curvature": 156.7,
      "curvature_level": 2,
      "name": "Main Street",
      "highway": "primary",
      "surface": "asphalt"
    }
  ],
  "is_public": false
}
```

**Response**:
```json
{
  "status": "success",
  "route_id": 42,
  "url_slug": "my-favorite-loop-a1b2c3d4",
  "share_url": "/routes/my-favorite-loop-a1b2c3d4"
}
```

#### GET /routes/list
List all routes for a session.

**Query Parameters**:
- `session_id`: User session ID (required)

**Response**:
```json
{
  "routes": [
    {
      "route_id": 42,
      "route_name": "My Favorite Loop",
      "total_curvature": 2450.5,
      "total_length_km": 45.2,
      "total_length_mi": 28.1,
      "segment_count": 120,
      "url_slug": "my-favorite-loop-a1b2c3d4",
      "created_at": "2024-01-07T14:30:00"
    }
  ]
}
```

#### GET /routes/{route_identifier}
Get route details by ID or URL slug.

**Path Parameters**:
- `route_identifier`: Route ID (integer) or URL slug (string)

**Response**:
```json
{
  "route_id": 42,
  "route_name": "My Favorite Loop",
  "description": "Great weekend ride",
  "total_curvature": 2450.5,
  "total_length_km": 45.2,
  "total_length_mi": 28.1,
  "segment_count": 120,
  "url_slug": "my-favorite-loop-a1b2c3d4",
  "created_at": "2024-01-07T14:30:00",
  "is_public": false,
  "geojson": {
    "type": "Feature",
    "geometry": {...},
    "properties": {...}
  },
  "segments": [...]
}
```

#### PUT /routes/{route_id}
Update route metadata.

**Query Parameters**:
- `session_id`: User session ID (required)
- `route_name`: New name (optional)
- `description`: New description (optional)
- `is_public`: New public status (optional)

**Response**:
```json
{
  "status": "success",
  "message": "Route updated"
}
```

#### DELETE /routes/{route_id}
Delete a saved route.

**Query Parameters**:
- `session_id`: User session ID (required for authorization)

**Response**:
```json
{
  "status": "success",
  "message": "Route deleted"
}
```

### Export Endpoints

#### GET /routes/{route_identifier}/export/kml
Export route as KML file for Google Earth.

**Returns**: KML file download

#### GET /routes/{route_identifier}/export/gpx
Export route as GPX file for GPS devices.

**Returns**: GPX file download

### Health Check

#### GET /health
Service health check.

**Response**:
```json
{
  "status": "healthy",
  "data_loaded": true,
  "collections_count": 500,
  "database_available": true
}
```

## Database Schema

### route_sessions
User sessions for route building.

| Column | Type | Description |
|--------|------|-------------|
| session_id | UUID | Primary key |
| created_at | TIMESTAMP | Creation time |
| last_accessed | TIMESTAMP | Last access time |
| session_name | VARCHAR(255) | Optional name |

### saved_routes
User-created routes.

| Column | Type | Description |
|--------|------|-------------|
| route_id | SERIAL | Primary key |
| session_id | UUID | FK to route_sessions |
| route_name | VARCHAR(255) | Route name |
| description | TEXT | Optional description |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |
| total_curvature | FLOAT | Sum of segment curvatures |
| total_length | FLOAT | Total length in meters |
| segment_count | INTEGER | Number of segments |
| geom | GEOMETRY(LineString) | PostGIS geometry |
| route_data | JSONB | Full segment details |
| url_slug | VARCHAR(50) | Unique URL slug |
| is_public | BOOLEAN | Public sharing enabled |

### route_segments
Normalized segment storage for querying.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| route_id | INTEGER | FK to saved_routes |
| position | INTEGER | Order in route (1, 2, 3...) |
| start_lat | DOUBLE PRECISION | Start latitude |
| start_lon | DOUBLE PRECISION | Start longitude |
| end_lat | DOUBLE PRECISION | End latitude |
| end_lon | DOUBLE PRECISION | End longitude |
| length | FLOAT | Segment length (meters) |
| radius | FLOAT | Circumcircle radius (meters) |
| curvature | FLOAT | Weighted curvature value |
| curvature_level | INTEGER | 0-4 (0=straight, 4=sharp) |
| source_way_id | BIGINT | OSM way ID |
| way_name | VARCHAR(500) | Road name |
| highway_type | VARCHAR(100) | Highway classification |
| surface_type | VARCHAR(100) | Surface type |

## Usage Examples

### Command Line (curl)

**Load data**:
```bash
curl -X POST "http://localhost:8000/data/load?filepath=/tmp/vermont.msgpack"
```

**Search for curvy roads**:
```bash
curl "http://localhost:8000/roads/geojson?min_curvature=1000&surface=paved&limit=50"
```

**Create session**:
```bash
SESSION=$(curl -X POST http://localhost:8000/sessions/create | jq -r '.session_id')
```

**Save a route**:
```bash
curl -X POST "http://localhost:8000/routes/save?session_id=$SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "route_name": "Test Route",
    "segments": [...]
  }'
```

### Python

```python
import requests

# Create session
response = requests.post('http://localhost:8000/sessions/create')
session_id = response.json()['session_id']

# Load data
requests.post('http://localhost:8000/data/load',
              params={'filepath': '/tmp/vermont.msgpack'})

# Search for roads
roads = requests.get('http://localhost:8000/roads/geojson',
                     params={'min_curvature': 1000, 'limit': 50})
print(roads.json())

# Get segments for stitching
segments = requests.get('http://localhost:8000/roads/segments',
                       params={'min_curvature': 500, 'limit': 1000})

# Save a route
route_data = {
    'route_name': 'My Route',
    'description': 'A great ride',
    'segments': [...],  # Array of segment objects
    'is_public': False
}
result = requests.post(f'http://localhost:8000/routes/save?session_id={session_id}',
                      json=route_data)
print(f"Route saved with slug: {result.json()['url_slug']}")
```

## Development

### Running Tests
```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run tests
pytest
```

### Database Migrations
For production, consider using Alembic for database migrations:
```bash
pip install alembic
alembic init migrations
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `GOOGLE_MAPS_API_KEY`: Google Maps API key (or set in config.py)

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
pg_isready

# Test connection
psql curvature -c "SELECT version();"

# Check PostGIS extension
psql curvature -c "SELECT PostGIS_Version();"
```

### Missing Dependencies
```bash
# Reinstall requirements
pip install -r requirements.txt --force-reinstall

# Check Python version
python --version  # Should be 3.7+
```

### Google Maps Not Loading
1. Check that `api/config.py` exists with a valid API key
2. Check browser console for errors
3. Verify API key has Maps JavaScript API enabled
4. Check for CORS issues (API allows all origins by default)

## Architecture

### Data Flow
1. **Browse Mode**: OSM data → msgpack → FastAPI → GeoJSON → Google Maps
2. **Stitch Mode**: OSM data → segments endpoint → User clicks → Route builder → PostgreSQL → KML/GPX export

### Session Management
- Sessions stored in PostgreSQL with UUID primary keys
- Session ID persisted in browser localStorage
- Automatic session restoration on page reload
- Routes associated with sessions for privacy

### Data Preservation
- Complete segment data (radius, curvature_level, etc.) stored in JSONB
- Normalized segment table for efficient queries
- PostGIS geometry for spatial operations
- No data loss compared to original msgpack format

## License

This code extends the adamfranco/curvature project. Please refer to the main project's license.

## Contributing

Contributions welcome! Please ensure:
- Code follows existing style
- Tests pass
- Database migrations included for schema changes
- API documentation updated
