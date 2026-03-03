# Routes

Routes are the core user-facing feature. Users build routes in the planner (`/planner`), save them, and later browse or manage them from two dedicated pages:

- **My Routes** (`/my-routes`) — the current user's saved routes (public and private)
- **Library** (`/library`) — all public routes from all users, browsable without a session

## Architecture Overview

```
Frontend Pages          API Endpoints              Service Layer           Repository
─────────────          ──────────────             ─────────────           ──────────
/my-routes       →     GET  /routes               list_routes()           get_by_session()
/library         →     GET  /routes/public         list_public_routes()    get_public()
/planner (save)  →     POST /routes               save_route()            create_route()
```

Routes are scoped to anonymous sessions identified by the `X-Session-Id` header. The session ID is stored in `localStorage` and managed by `useWaypointRouteStore`.

## Backend

### API Endpoints

All route endpoints live under the `/routes` prefix (`api/routers/routes.py`).

| Method   | Path                              | Auth Required | Description                          |
|----------|-----------------------------------|---------------|--------------------------------------|
| `POST`   | `/routes`                         | Session       | Save a new route                     |
| `GET`    | `/routes`                         | Session       | List routes for the current session  |
| `GET`    | `/routes/public`                  | None          | List all public routes (paginated)   |
| `GET`    | `/routes/shared/{slug}`           | None          | Get a public route by URL slug       |
| `GET`    | `/routes/{route_id}`              | None          | Get route details by ID              |
| `PUT`    | `/routes/{route_id}`              | Session       | Update route metadata                |
| `DELETE` | `/routes/{route_id}`              | Session       | Delete a route                       |
| `GET`    | `/routes/shared/{slug}/export/gpx`| None          | Export route as GPX file             |
| `GET`    | `/routes/shared/{slug}/export/kml`| None          | Export route as KML file             |

**Endpoint ordering matters.** FastAPI matches routes in declaration order. `/routes/public` and `/routes/shared/{slug}` are declared before `/routes/{route_id}` to prevent FastAPI from matching "public" or "shared" as a `route_id` parameter.

### Public Routes Endpoint

`GET /routes/public?limit=50&offset=0`

Returns all routes where `is_public=True`, ordered by `created_at DESC`. No session header required.

**Query parameters:**
- `limit` (int, 1-100, default 50) — max routes to return
- `offset` (int, >= 0, default 0) — pagination offset

**Response:** `RouteListResponse` containing an array of `RouteResponse` objects.

### Data Flow

1. **Repository** (`api/repositories/route_repository.py`) — raw database queries
   - `get_by_session(session_id)` — returns all routes for a session
   - `get_public(limit, offset)` — returns paginated public routes
2. **Service** (`api/services/route_service.py`) — business logic and response mapping
   - `list_routes(session_id)` — maps session routes to `RouteListResponse`
   - `list_public_routes(limit, offset)` — maps public routes to `RouteListResponse`
3. **Router** (`api/routers/routes.py`) — HTTP layer, dependency injection, error handling

### Route Types

Routes have a `route_type` field with two values:

- `segment_list` — built from curvature road segments, stored with `RouteSegment` records
- `waypoint` — built from map waypoints with OSRM connecting geometry, stored with `RouteWaypoint` records

### Road Rating

Waypoint routes compute a `road_rating` from average curvature per waypoint:

| Curvature Range | Rating     |
|-----------------|------------|
| 0               | None       |
| < 600           | RELAXED    |
| < 1,000         | SPIRITED   |
| < 2,000         | ENGAGING   |
| < 5,000         | TECHNICAL  |
| < 10,000        | EXPERT     |
| >= 10,000       | LEGENDARY  |

## Frontend

### API Client

All route API functions live in `frontend/lib/routes-api.ts`:

| Function             | Endpoint             | Session Required | Description                    |
|----------------------|----------------------|------------------|--------------------------------|
| `saveRoute()`        | `POST /routes`       | Yes              | Save a new route               |
| `listRoutes()`       | `GET /routes`        | Yes              | List user's routes             |
| `listPublicRoutes()` | `GET /routes/public` | No               | List all public routes         |
| `getRoute()`         | `GET /routes/{id}`   | No               | Get route detail               |
| `deleteRoute()`      | `DELETE /routes/{id}` | Yes             | Delete a route                 |
| `getGpxExportUrl()`  | —                    | —                | Returns GPX download URL       |
| `getKmlExportUrl()`  | —                    | —                | Returns KML download URL       |

### Pages

#### My Routes (`/my-routes`)

**File:** `frontend/app/my-routes/page.tsx`

Displays the current user's saved routes. Requires a session — reads `sessionId` from `useWaypointRouteStore`.

- Fetches routes via `listRoutes(sessionId)` on mount
- Renders a grid of `RouteCard` components
- Each card has a delete button that calls `deleteRoute()` and removes the card from state
- Shows loading spinner, error state with retry, or empty state with CTA to `/planner`

#### Library (`/library`)

**File:** `frontend/app/library/page.tsx`

Displays all public routes from all users. No session required.

- Fetches routes via `listPublicRoutes()` on mount
- Renders a grid of `RouteCard` components
- Each card has GPX and KML download links using `getGpxExportUrl(slug)` / `getKmlExportUrl(slug)`
- Shows loading spinner, error state with retry, or empty state

### RouteCard Component

**File:** `frontend/components/RouteCard.tsx`

Shared card component used on both pages. Accepts a `RouteResponse` and an optional `actions` React node.

**Displays:**
- Route name
- Road rating badge (color-coded by level)
- Distance in miles
- Description (truncated to 2 lines via `line-clamp-2`)
- Waypoint/segment count
- Creation date

**Props:**
- `route: RouteResponse` — the route data
- `actions?: ReactNode` — slot for page-specific buttons (delete, download, etc.)

### Navigation

Both desktop and mobile navigation link to the route pages:

| Nav Label | Destination    | Component                          |
|-----------|----------------|------------------------------------|
| EXPLORE   | `#explore`     | Anchor link (landing page section) |
| ROUTES    | `/my-routes`   | `<Link>` (Next.js client nav)      |
| LIBRARY   | `/library`     | `<Link>` (Next.js client nav)      |
| ABOUT     | `#about`       | Anchor link (landing page section) |

Desktop nav is in `frontend/app/page.tsx`. Mobile nav is in `frontend/components/MobileNav.tsx` — internal links use `<Link>` from `next/link`, anchor links use `<a>`.
