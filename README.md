# B-Road

**Discover America's best driving roads. Plan your adventure. Hit the road.**

B-Road is a road discovery and trip planning platform for driving enthusiasts. Built on [Adam Franco's curvature algorithm](https://github.com/adamfranco/curvature), it analyzes OpenStreetMap data to rate every road's twistiness — then lets you explore them on an interactive map, build routes, and export them for navigation.

<!-- TODO: Add screenshots of the /planner map view with waypoints and the landing page -->

## Features

### Explore

- Interactive map with **2.1M+ rated road segments** across all 50 US states
- Color-coded by Road Rating (Relaxed through Legendary)
- Multiple base map styles, smooth viewport-based data loading
- Click any road for details, Google Street View, and curvature stats

### Plan

- Click curvature segments to add waypoints with OSRM road-snapped routing
- Draggable waypoint markers with real-time route recalculation
- Live route stats (distance, curvature, segment count)

### Save and Share

- Save routes with names and descriptions
- Share via public URL slug
- Export as GPX or KML for GPS devices
- Open full routes in Google Maps for turn-by-turn navigation

### Search

- AI-powered natural language search ("find twisty mountain roads in Vermont")
- Conversation history with follow-up context
- Results highlighted on the map for easy identification

### Discover

- Gas station and EV charging station map layers
- Google Street View integration from any road segment
- State-by-state filtering

## Road Rating System

Every road segment is scored by curvature and assigned a Road Rating:

| Rating | Curvature | Color | Description |
|---|---|---|---|
| Relaxed | < 600 | Sky Blue | Gentle curves, easy cruising |
| Spirited | 600 – 1,000 | Emerald | Pleasant, flowing curves |
| Engaging | 1,000 – 2,000 | Amber | Moderately twisty |
| Technical | 2,000 – 5,000 | Deep Orange | Seriously curvy |
| Expert | 5,000 – 10,000 | Crimson | White-knuckle twisties |
| Legendary | 10,000+ | Electric Purple | The twistiest roads in America |

## Quick Start

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- [Mapbox access token](https://www.mapbox.com/)
- [Anthropic API key](https://console.anthropic.com/) (optional — enables AI search)

### Get running

```bash
git clone https://github.com/GeorgeSmith-Sweeper/B-Road.git
cd B-Road
cp .env.example .env
# Edit .env — add your MAPBOX_ACCESS_TOKEN (and optionally ANTHROPIC_API_KEY)
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) and start exploring.

For detailed setup — data loading, OSRM routing, manual installation — see [API_README.md](API_README.md).

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, Mapbox GL JS, Zustand, TypeScript, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy, Python 3.11 |
| Database | PostgreSQL 15 + PostGIS |
| Map | Mapbox GL JS with custom curvature tile layers |
| AI Search | Anthropic Claude SDK |
| Routing | OSRM (Open Source Routing Machine) |
| Data | OpenStreetMap via curvature processing pipeline |

## Architecture

```
OSM Data (.pbf)
    |
    v
Curvature Pipeline (Python + NumPy)
    |
    v
PostGIS (spatial segments, ways, tags)
    |
    v
FastAPI (GeoJSON API + vector tiles)
    |
    v
Next.js + Mapbox GL JS (interactive map, route planner, AI search)
```

## Documentation

- **[API_README.md](API_README.md)** — Full API reference, endpoint docs, database schema, and detailed setup
- **[CURVATURE_ORIGINAL_README.md](CURVATURE_ORIGINAL_README.md)** — Original curvature algorithm documentation

## Built On

B-Road is built on [Adam Franco's curvature project](https://github.com/adamfranco/curvature), which pioneered the algorithm for analyzing OpenStreetMap way geometry and calculating road curvature scores. The original project provides the data processing pipeline and curvature calculations that power B-Road's road ratings. B-Road extends this foundation with an interactive map interface, waypoint routing, route saving and sharing, AI-powered search, and GPX/KML export.

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes with clear messages
4. Push to your branch and open a Pull Request

## License

This project inherits the license from [adamfranco/curvature](https://github.com/adamfranco/curvature). Please refer to the original project for license details.
