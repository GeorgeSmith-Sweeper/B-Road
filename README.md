# B-Road: Enhanced Curvature Road Analyzer

B-Road is an enhanced version of [adamfranco/curvature](https://github.com/adamfranco/curvature) that adds interactive route building and saving capabilities. Find the twistiest roads, build custom routes by stitching segments together, and export them for your GPS device or Google Earth.

## 🎯 What's New in B-Road

### Route Stitching & Saving
- **Interactive Route Builder**: Click road segments on a map to build custom turn-by-turn routes
- **Smart Validation**: Automatically ensures segments connect end-to-end
- **Real-Time Stats**: See distance and curvature totals as you build
- **Persistent Storage**: Save routes to PostgreSQL/PostGIS with full segment details
- **Multiple Export Formats**: Download as KML (Google Earth) or GPX (GPS devices)
- **Shareable URLs**: Every route gets a unique URL for easy sharing
- **Session Management**: Your routes persist across browser sessions

### Enhanced Web Interface
- **Dual Mode Operation**:
  - **Browse Mode** (original): Search and explore curvy roads
  - **Build Mode** (new): Click segments to create custom routes
- **Interactive Map**: Google Maps integration with segment-level selection
- **Saved Routes Library**: View, manage, and export all your saved routes

## 🚀 Quick Start

### Prerequisites

- Python 3.7+
- PostgreSQL 12+ with PostGIS extension
- Google Maps API key ([get one here](https://developers.google.com/maps/documentation/javascript/get-api-key))
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

# Run schema for saved routes
psql curvature < api/schema/saved_routes.sql
```

3. **Install Python dependencies**:
```bash
cd api
pip install -r requirements.txt
```

4. **Configure API keys**:
```bash
# Copy example config
cp config.example.py config.py

# Edit config.py and add your credentials:
# - GOOGLE_MAPS_API_KEY = "your_key_here"
# - DATABASE_URL = "postgresql://user:password@localhost:5432/curvature"
```

5. **Process OpenStreetMap data** (using original curvature tools):
```bash
# Example: Process Vermont data
./processing_chains/adams_default.sh vermont-latest.osm.pbf vermont

# This creates vermont.msgpack for loading into the web interface
```

6. **Start the server**:
```bash
python server.py
```

7. **Open the web interface**:
```
http://localhost:8000/static/index.html
```

## 📖 Usage Guide

### Browse Mode (Original Curvature Functionality)

1. **Load Data**: Enter the path to your processed `.msgpack` file
2. **Set Filters**: Adjust minimum curvature, surface type, and result limit
3. **Search**: Click "Search Roads" to display curvy roads on the map
4. **Explore**: Click roads to see details, zoom to specific routes

### Build Route Mode (New Feature)

1. **Switch Mode**: Click the "Build Route" button
2. **Load Segments**: Load data and search to display clickable road segments
3. **Build Route**: Click connected segments in sequence to build your route
   - Segments must connect end-to-end (the system validates this)
   - Watch real-time stats update: distance, curvature, segment count
4. **Save Route**:
   - Enter a route name and optional description
   - Click "Save Route"
   - Route is stored in the database with unique URL
5. **Manage Routes**:
   - View saved routes in the sidebar
   - Click "View" to display on map
   - Export as KML or GPX
   - Delete routes you no longer need

## 📚 Documentation

- **[API Documentation](API_README.md)**: Complete REST API reference with endpoints, examples, and troubleshooting
- **[Original Curvature README](CURVATURE_ORIGINAL_README.md)**: Documentation for the base curvature analysis tools

## 🗺️ Example Use Cases

- **Motorcycle Trip Planning**: Find the curviest roads and stitch them into a day trip
- **Cycling Routes**: Build scenic routes with optimal curvature for road cycling
- **Driving Tours**: Create custom scenic drives through mountainous regions
- **GPS Navigation**: Export routes to GPX for use in Garmin, etc.
- **Route Sharing**: Share your favorite twisty road combinations via URL

## 🛠️ Technology Stack

**Backend**:
- FastAPI - Modern Python web framework
- PostgreSQL + PostGIS - Spatial database
- SQLAlchemy - ORM with geographic types
- Shapely - Geometric operations
- gpxpy - GPX file generation

**Frontend**:
- Google Maps JavaScript API
- Vanilla JavaScript (no frameworks)
- Responsive CSS design

**Data Processing** (original curvature):
- Python 3.7+
- PyOsmium - OpenStreetMap data parsing
- NumPy - Mathematical operations
- MessagePack - Binary data serialization

## 📊 Database Schema

B-Road adds three new tables to store saved routes:

- **`route_sessions`**: User session management
- **`saved_routes`**: Route metadata with PostGIS geometry
- **`route_segments`**: Individual segments with full curvature data

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

### Original Endpoints
- `POST /data/load` - Load msgpack data file
- `GET /roads/geojson` - Get roads as GeoJSON
- `GET /roads` - Search roads (simple JSON)

### New Route Stitching Endpoints
- `POST /sessions/create` - Create user session
- `GET /roads/segments` - Get individual segments for stitching
- `POST /routes/save` - Save a stitched route
- `GET /routes/list` - List saved routes
- `GET /routes/{slug}` - Get route details
- `DELETE /routes/{id}` - Delete route
- `GET /routes/{slug}/export/kml` - Export as KML
- `GET /routes/{slug}/export/gpx` - Export as GPX

See [API_README.md](API_README.md) for complete endpoint documentation.

## 🎬 Demo

*(Add screenshots or GIFs here once deployed)*

## 🚧 Roadmap

Future enhancements being considered:

- [ ] User authentication and accounts
- [ ] Public route sharing gallery
- [ ] Route elevation profiles
- [ ] Mobile-responsive design improvements
- [ ] Offline map support
- [ ] Route optimization suggestions
- [ ] Integration with weather APIs
- [ ] Social features (likes, comments on routes)

## 📈 Project Status

**Current Version**: 1.0.0 (Initial Release)

**Status**: Active development - the core features are stable and functional.

---

**Built on the shoulders of [adamfranco/curvature](https://github.com/adamfranco/curvature) 🏔️**
