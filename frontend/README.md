# B-Road Mapbox Frontend

Modern Next.js 14 frontend for the B-Road Curvature project, replacing the vanilla JavaScript + Google Maps implementation with React + Mapbox GL JS.

## Features

- **Two Route Modes**: Manual Waypoint routing and Auto Curvy Route finder
- **Waypoint Route Builder**: Click road segments to add waypoints, drag to adjust, save and export routes
- **Curvy Route Finder**: Set start/end points on the map and automatically find the twistiest route between them
- **Curvature Visualization**: Smooth green-to-purple color gradient and curvature-scaled line widths — twistier roads visually pop off the map
- **Mapbox GL JS Integration**: Fast, modern mapping with vector tiles
- **TypeScript**: Full type safety throughout the application
- **Zustand State Management**: Lightweight and performant state management
- **Session Persistence**: Routes saved to your session with localStorage
- **Export Support**: Export routes to GPX/KML formats
- **Google Maps Integration**: Street View previews, Google Maps links, and Get Directions from waypoint lists and map popups

## Tech Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Mapbox GL JS v3**: Modern web mapping library
- **Zustand**: Lightweight state management
- **Tailwind CSS**: Utility-first CSS framework
- **Axios**: HTTP client for API requests

## Prerequisites

- Node.js 18+ and npm
- Running FastAPI backend on `http://localhost:8000`
- Mapbox API token configured in backend

## Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local

# Edit .env.local if your API is not on localhost:8000
```

## Development

```bash
# Start development server
npm run dev

# Open browser to http://localhost:3000
```

## Build for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx                 # Root layout with metadata
│   ├── page.tsx                   # Main application page
│   └── globals.css                # Global styles
├── components/
│   ├── Map.tsx                    # Mapbox GL JS map with curvature gradient, route rendering
│   ├── Sidebar.tsx                # Control panel with mode toggle
│   ├── WaypointRouteBuilder.tsx   # Manual waypoint routing panel
│   └── CurvyRouteFinder.tsx       # Auto curvy route finder panel
├── hooks/
│   └── useRouting.ts              # OSRM route calculation hook
├── store/
│   ├── useAppStore.ts             # Global app state (sources, filters)
│   ├── useChatStore.ts            # Chat/search state
│   ├── useWaypointRouteStore.ts   # Waypoint routing state + session
│   └── useCurvyRouteStore.ts      # Curvy route finder state
├── lib/
│   ├── api.ts                     # API client for FastAPI backend
│   ├── routing-api.ts             # OSRM + curvy route API client
│   ├── routes-api.ts              # Route saving/loading API client
│   └── google-maps.ts             # Google Maps/Street View URL helpers
└── types/
    ├── index.ts                   # General TypeScript type definitions
    └── routing.ts                 # Routing-specific types
```

## API Integration

The frontend communicates with the FastAPI backend using the following endpoints:

- `GET /config` - Get Mapbox API token
- `GET /curvature/sources` - List available curvature data sources
- `GET /curvature/tiles/{z}/{x}/{y}.pbf` - Vector tiles for map rendering
- `POST /routing/calculate` - Calculate OSRM route between waypoints
- `POST /routing/curvy-route` - Find curvy route between start/end points
- `GET /routing/health` - Check OSRM availability
- `POST /sessions` - Create anonymous session
- `POST /routes` - Save route
- `GET /routes` - List saved routes
- `GET /routes/:id` - View route details
- `DELETE /routes/:id` - Delete route
- `GET /routes/shared/:slug/export/gpx` - Export route as GPX
- `GET /routes/shared/:slug/export/kml` - Export route as KML

## Environment Variables

- `NEXT_PUBLIC_API_URL`: Backend API URL (default: `http://localhost:8000`)

## Known Issues

See CLAUDE.md in the root directory for current sprint focus and known issues.

## Migration from Google Maps

This frontend replaces the vanilla JavaScript implementation in `web/static/`:
- Google Maps API → Mapbox GL JS v3
- Vanilla JS → React + Next.js 14
- No state management → Zustand
- Inline styles → Tailwind CSS
- No types → Full TypeScript coverage

All functionality from the original implementation has been preserved and enhanced.
