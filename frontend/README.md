# B-Road Mapbox Frontend

Modern Next.js 14 frontend for the B-Road Curvature project, replacing the vanilla JavaScript + Google Maps implementation with React + Mapbox GL JS.

## Features

- **Address Search**: Type an address to search via Mapbox Geocoding, fly to the result, and add it as a waypoint
- **Waypoint Route Builder**: Click road segments to add waypoints, drag to adjust, save and export routes
- **Curvature Visualization**: Smooth green-to-purple color gradient and curvature-scaled line widths — twistier roads visually pop off the map
- **Mapbox GL JS Integration**: Fast, modern mapping with vector tiles
- **TypeScript**: Full type safety throughout the application
- **Zustand State Management**: Lightweight and performant state management
- **Session Persistence**: Routes saved to your session with localStorage
- **Export Support**: Export routes to GPX/KML formats
- **Google Maps Integration**: Street View previews, Google Maps links, and Get Directions from waypoint lists and map popups
- **Map Layers**: Toggle gas stations (via Mapbox Streets vector tiles) and EV charging stations (via NREL API) as map overlays

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
│   ├── AddressSearchBar.tsx       # Floating address search with autocomplete
│   ├── LayerMenu.tsx              # Popover menu to toggle gas/EV map layers
│   ├── Sidebar.tsx                # Control panel with filters and route builder
│   └── WaypointRouteBuilder.tsx   # Manual waypoint routing panel
├── hooks/
│   ├── useRouting.ts              # OSRM route calculation hook
│   └── useGeocode.ts              # Debounced Mapbox geocoding hook
├── store/
│   ├── useAppStore.ts             # Global app state (sources, filters, map center)
│   ├── useChatStore.ts            # Chat/search state
│   ├── useGeocoderStore.ts        # Address search/geocoding state
│   ├── useWaypointRouteStore.ts   # Waypoint routing state + session
│   └── useLayerStore.ts           # Gas station / EV charging layer toggles
├── lib/
│   ├── api.ts                     # API client for FastAPI backend
│   ├── geocoding-api.ts           # Mapbox Geocoding API v6 client
│   ├── nrel-api.ts                # NREL EV charging station API client
│   ├── routing-api.ts             # OSRM route API client
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
- `NEXT_PUBLIC_NREL_API_KEY`: NREL API key for EV charging station data (free signup at https://developer.nrel.gov/signup/). Falls back to `DEMO_KEY` with rate limits.

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
