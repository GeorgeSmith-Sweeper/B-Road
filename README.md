# B-Road: Scalable Curvature Road Visualization Platform

B-Road is a database-backed curvature visualization platform built on [adamfranco/curvature](https://github.com/adamfranco/curvature). It provides an interactive web interface for exploring the world's twistiest roads using PostGIS spatial queries and viewport-based data loading.

## 🎯 What's New in B-Road

### AI-Powered Natural Language Search
- **Chat Interface**: Ask questions like "Find super twisty roads in Vermont" or "Show me epic curvy mountain roads"
- **Claude AI Integration**: Powered by Anthropic's Claude to interpret natural language into structured database queries
- **Conversation History**: Follow-up queries maintain context (e.g., "now show me shorter ones")
- **Map Highlighting**: Search results are highlighted on the map in cyan for easy identification

### Route Builder
- **Click-to-Add**: Click road segments on the map to build custom driving routes
- **Route Management**: Reorder, remove, and clear segments with live stats (distance, curvature, segment count)
- **Save & Share**: Save routes with names and descriptions; share public routes via unique URL slugs
- **Google Maps Directions**: Export full routes to Google Maps for turn-by-turn navigation

### Google Maps & Street View Integration
- **Map Popups**: View any road segment in Google Maps or Street View directly from the map popup
- **Route Builder Links**: Each segment in a route includes Google Maps and Street View shortcuts
- **No API Key Required**: Uses Google's public URL schemes for seamless access

### PostGIS Spatial Database
- **Scalable Storage**: Curvature data stored in PostgreSQL/PostGIS with spatial indexes
- **Viewport-Based Loading**: Efficiently loads only segments visible in the current map view
- **Multi-State Support**: Query and visualize curvature data across all 50 US states (2.1M+ segments)
- **Optimized Queries**: Spatial indexes and zoom-based filtering for fast performance
- **Source Filtering**: Filter by state/region to explore specific areas

### Modern Web Interface
- **Interactive Map**: Mapbox GL JS with smooth panning and zooming
- **Real-Time Data Loading**: Segments load automatically as you pan/zoom the map
- **Curvature-Based Styling**: Color-coded roads by twistiness (yellow to purple)
- **State Selector**: Filter data by US state or view all states at once
- **Responsive Design**: Clean, modern UI built with Next.js and React

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 12+ with PostGIS extension
- Node.js 18+ and npm (for frontend)
- Docker and Docker Compose (recommended)
- Mapbox API token ([get one here](https://www.mapbox.com/))
- Anthropic API key ([get one here](https://console.anthropic.com/)) - for AI chat search
- OpenStreetMap data in PBF or XML format

### Installation

1. **Clone the repository**:
```bash
git clone https://github.com/GeorgeSmith-Sweeper/B-Road.git
cd B-Road
```

2. **Set up the database**:
```bash
# Create database
createdb curvature

# Enable PostGIS extension
psql curvature -c "CREATE EXTENSION postgis;"

# Run curvature schema (this creates the required tables)
psql curvature < api/schema/curvature.sql

# Add spatial indexes for performance
psql curvature < api/schema/curvature_indexes.sql
```

3. **Install Python dependencies**:
```bash
# Create and activate virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
cd api
pip install -r requirements.txt
```

4. **Configure environment variables**:
```bash
# Create .env file in the api/ directory
cd api
cat > .env <<EOF
DATABASE_URL=postgresql://user:password@localhost:5432/curvature
MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
EOF
```

5. **Process OpenStreetMap data and load into PostGIS**:
```bash
# Download OSM data (example: Vermont)
wget https://download.geofabrik.de/north-america/us/vermont-latest.osm.pbf

# Process with curvature and load directly into PostGIS
./processing_chains/adams_default.sh vermont-latest.osm.pbf vermont | \
  ./bin/curvature-output-postgis --source vermont

# Repeat for additional states as needed
```

6. **Install and start the frontend**:
```bash
# Install frontend dependencies
cd frontend
npm install

# Start the Next.js development server
npm run dev
```

7. **Start the backend API**:
```bash
# In a separate terminal, from the project root
cd api
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

8. **Open the application**:
```
Frontend: http://localhost:3000
API Docs: http://localhost:8000/docs
```

## 📖 Usage Guide

### Exploring Curvature Data

1. **Initial View**: The map loads centered on Vermont with curvature segments visible
2. **Pan and Zoom**: Move the map around to load segments for different areas
   - Segments automatically load for the visible viewport
   - Zoom in for more detailed segments, zoom out for major routes only
3. **Filter by State**: Use the state dropdown in the sidebar to focus on specific regions
4. **Adjust Curvature**: Use the minimum curvature slider to filter by road twistiness
   - 300-600: Pleasant, flowing curves (yellow)
   - 600-1000: Moderately twisty (orange)
   - 1000-2000: Very curvy roads (red)
   - 2000+: Extremely twisty! (purple)
5. **Click Roads**: Click any road segment to see details:
   - Road name, curvature score, length, and surface type
   - Google Maps and Street View links

### AI Chat Search

1. **Open Chat**: Click the chat icon in the bottom-right corner
2. **Ask Questions**: Type natural language queries like:
   - "Find twisty roads in Vermont"
   - "Show me epic curvy mountain roads in Colorado"
   - "Short paved roads with high curvature near California"
3. **Follow Up**: Ask follow-up questions that maintain context (e.g., "now show shorter ones")
4. **View Results**: Matching roads are highlighted in cyan on the map

### Building Routes

1. **Click Segments**: Click road segments on the map to add them to your route
2. **Manage Route**: Use the route builder panel to reorder, remove, or clear segments
3. **Save Route**: Give your route a name and description, optionally make it public
4. **Share**: Copy the public URL to share your route with others
5. **Navigate**: Click "Get Directions in Google Maps" to export your route for navigation

### Performance Tips

- The map automatically adjusts the minimum curvature based on zoom level
- Zoomed out (z < 8): Shows only roads with curvature > 1000
- Medium zoom (z 8-10): Shows roads with curvature > 500
- Zoomed in (z > 10): Shows all roads above your selected minimum

## 📚 Documentation

- **[API Documentation](API_README.md)**: Complete REST API reference with endpoints, examples, and troubleshooting
- **[Original Curvature README](CURVATURE_ORIGINAL_README.md)**: Documentation for the base curvature analysis tools

## 🗺️ Example Use Cases

- **Motorcycle Trip Planning**: Discover the twistiest roads in your region or across multiple states
- **Cycling Routes**: Find scenic, curvy roads perfect for road cycling adventures
- **Driving Tours**: Explore mountainous regions and discover hidden scenic routes
- **Data Analysis**: Query and analyze road curvature patterns across large geographic areas
- **Travel Research**: Compare curvature profiles of different states and regions

## 🛠️ Technology Stack

**Backend**:
- FastAPI - Modern async Python web framework
- PostgreSQL 12+ with PostGIS - Spatial database with geometric operations
- SQLAlchemy - Database ORM with spatial query support
- Anthropic Claude SDK - AI-powered natural language search
- Python 3.11+ - Core language

**Frontend**:
- Next.js 14 - React framework with App Router
- Mapbox GL JS - Interactive map rendering
- Zustand - Lightweight state management
- React Hot Toast - Toast notifications
- TypeScript - Type-safe development
- Tailwind CSS - Utility-first styling

**Data Processing** (from curvature project):
- Python 3.11+
- PyOsmium - OpenStreetMap data parsing
- NumPy - Mathematical operations for curvature calculations
- MessagePack - Binary data serialization

## 📊 Database Schema

B-Road uses the curvature project's PostGIS schema with spatial indexes:

- **`curvature_segments`**: Road segments with LINESTRING geometry (SRID 900913)
- **`segment_ways`**: Constituent OSM ways that make up each segment
- **`sources`**: Data sources (typically US states or regions)
- **`tags`**: Highway types, surface types, and other OSM tags

Spatial indexes on `curvature_segments.geom` enable fast bounding-box queries.

See [API_README.md](API_README.md) for complete schema documentation.

## 🔄 Keeping Up with Upstream

This project is based on adamfranco/curvature. To pull in updates from the original project:

```bash
# Add upstream remote (if not already added)
git remote add upstream https://github.com/adamfranco/curvature.git

# Fetch and merge updates
git fetch upstream
git merge upstream/master
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes with clear messages
4. Push to your branch
5. Open a Pull Request

## 📝 License

This project inherits the license from [adamfranco/curvature](https://github.com/adamfranco/curvature). Please refer to the original project for license details.

## 🙏 Acknowledgments

- **Adam Franco** - Original [curvature](https://github.com/adamfranco/curvature) project
- **OpenStreetMap Contributors** - Map data
- Built with assistance from [Claude Code](https://claude.com/claude-code)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/GeorgeSmith-Sweeper/B-Road/issues)
- **Discussions**: [GitHub Discussions](https://github.com/GeorgeSmith-Sweeper/B-Road/discussions)
- **Original Project**: [adamfranco/curvature](https://github.com/adamfranco/curvature)

## 🗺️ API Endpoints Overview

### Curvature Data Endpoints
- `GET /curvature/segments` - Get segments by bounding box (viewport-based)
- `GET /curvature/sources` - List available data sources (states)
- `GET /curvature/sources/{name}/segments` - Get all segments for a source
- `GET /curvature/sources/{name}/bounds` - Get geographic bounds of a source
- `GET /curvature/segments/{id}` - Get detailed info for a single segment

### AI Chat Search Endpoints
- `POST /chat/search` - Natural language road search with conversation history
- `POST /chat/extract-filters` - Extract structured filters from natural language
- `GET /chat/health` - Claude service health check

### Route Builder Endpoints
- `POST /sessions` - Create anonymous session
- `POST /routes` - Save a route
- `GET /routes` - List routes for session
- `GET /routes/{route_id}` - Get route details
- `GET /routes/shared/{slug}` - Get public route by URL slug
- `PUT /routes/{route_id}` - Update route
- `DELETE /routes/{route_id}` - Delete route

### Health & Configuration
- `GET /health` - API health check
- `GET /config` - Get frontend configuration (Mapbox token, etc.)
- `GET /docs` - Interactive API documentation (Swagger UI)

See [API_README.md](API_README.md) for complete endpoint documentation.

## 🎬 Demo

*(Add screenshots or GIFs here once deployed)*

## 🚧 Roadmap

Future enhancements being considered:

- [x] Route building and saving (click segments to build custom routes)
- [x] AI-powered natural language search
- [x] Google Maps and Street View integration
- [ ] GPX/KML export for saved routes
- [ ] Elevation profiles using SRTM data
- [ ] Additional map layers (satellite, terrain)
- [ ] Mobile app with offline support
- [ ] Worldwide coverage (currently US-focused)
- [ ] Route optimization and suggestions
- [ ] Integration with weather and road condition APIs
- [ ] User accounts and public route sharing

## 📈 Project Status

**Current Version**: 1.1.0

**Status**: Active development - the core features are stable and functional.

---

**Built on the shoulders of [adamfranco/curvature](https://github.com/adamfranco/curvature) 🏔️**
