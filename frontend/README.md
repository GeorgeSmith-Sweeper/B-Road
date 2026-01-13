# B-Road Mapbox Frontend

Modern Next.js 14 frontend for the B-Road Curvature project, replacing the vanilla JavaScript + Google Maps implementation with React + Mapbox GL JS.

## Features

- **Dual Mode UI**: Browse roads or build custom routes
- **Mapbox GL JS Integration**: Fast, modern mapping with vector tiles
- **TypeScript**: Full type safety throughout the application
- **Zustand State Management**: Lightweight and performant state management
- **Route Building**: Click connected segments to build custom twisty routes
- **Session Persistence**: Routes saved to your session with localStorage
- **Export Support**: Export routes to GPX/KML formats

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
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Main application page
│   └── globals.css         # Global styles
├── components/
│   ├── Map.tsx             # Mapbox GL JS map component
│   └── Sidebar.tsx         # Control panel and UI
├── store/
│   └── useAppStore.ts      # Zustand store for state management
├── lib/
│   └── api.ts              # API client for FastAPI backend
└── types/
    └── index.ts            # TypeScript type definitions
```

## API Integration

The frontend communicates with the FastAPI backend using the following endpoints:

- `GET /config` - Get Mapbox API token
- `POST /data/load` - Load curvature data from msgpack
- `GET /roads/geojson` - Search roads (browse mode)
- `GET /roads/segments` - Load segments (route building)
- `POST /sessions/create` - Create user session
- `POST /routes/save` - Save route
- `GET /routes/list` - List saved routes
- `GET /routes/:slug` - View route details
- `DELETE /routes/:id` - Delete route
- `GET /routes/:slug/export/:format` - Export route (GPX/KML)

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
