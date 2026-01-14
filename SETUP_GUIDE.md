# B-Road Mapbox Frontend Setup Guide

## Quick Start

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev

# Open http://localhost:3000 in your browser
```

## Backend Requirements

Before starting the frontend, ensure your FastAPI backend is configured:

### 1. Update Backend Configuration

The backend must return a Mapbox API token instead of Google Maps key. Update your `/config` endpoint:

**Before (Google Maps):**
```python
@app.get("/config")
async def get_config():
    return {
        "google_maps_api_key": os.getenv("GOOGLE_MAPS_API_KEY")
    }
```

**After (Mapbox):**
```python
@app.get("/config")
async def get_config():
    return {
        "mapbox_api_key": os.getenv("MAPBOX_API_KEY")
    }
```

### 2. Get a Mapbox API Token

1. Create a free account at https://account.mapbox.com/
2. Go to your account dashboard
3. Copy your default public token (starts with `pk.`)
4. Add it to your backend environment variables:

```bash
# In your backend .env file
MAPBOX_API_KEY=pk.eyJ1...your-token-here
```

### 3. Start the Backend

```bash
cd api
uvicorn server:app --reload
# Backend should be running on http://localhost:8000
```

## Frontend Configuration

### Environment Variables

Create a `.env.local` file in the `frontend/` directory:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

If your backend is running on a different host/port, update accordingly.

### Development Server

```bash
cd frontend
npm run dev
```

The application will be available at http://localhost:3000

### Production Build

```bash
cd frontend
npm run build
npm start
```

## Testing the Application

### 1. Load Data
- Enter the path to your curvature msgpack file (e.g., `/tmp/vermont.msgpack`)
- Click "Load Data"
- You should see a success message

### 2. Browse Roads
- In "Browse Roads" mode:
  - Adjust the minimum curvature slider
  - Select surface type (paved/unpaved)
  - Set max results
  - Click "Search Roads"
- Roads should appear on the map color-coded by curvature:
  - Yellow: 0-600 (mild curves)
  - Orange: 600-1000 (moderate curves)
  - Red: 1000-2000 (very curvy)
  - Purple: 2000+ (extremely curvy)
- Click any road to see details in a popup

### 3. Build Routes
- Switch to "Build Route" mode
- Search for segments (they'll load automatically)
- Click connected segments on the map to build your route
  - Segments must connect end-to-end
  - If you click a non-connected segment, you'll get an error
- Watch the route statistics update:
  - Segment count
  - Total distance
  - Total curvature
- Enter a route name and optional description
- Click "Save Route"

### 4. Manage Saved Routes
- View your saved routes in the sidebar
- Click "View" to display a route on the map
- Click "GPX" or "KML" to export the route
- Click "Delete" to remove a route

### 5. Session Persistence
- Refresh the page - your session should be restored
- Your saved routes should still be available
- If you clear localStorage, a new session will be created

## Troubleshooting

### Map Not Loading
**Problem:** Map shows "Loading map configuration..." indefinitely

**Solutions:**
1. Check that backend is running: `curl http://localhost:8000/config`
2. Verify Mapbox token is set in backend
3. Check browser console for errors
4. Verify CORS is enabled on backend

### Data Not Loading
**Problem:** "Failed to load data" error

**Solutions:**
1. Verify the msgpack file path exists
2. Check backend logs for errors
3. Ensure the file is in the correct format
4. Try with a known-good file (e.g., `/tmp/vermont.msgpack`)

### Roads Not Displaying
**Problem:** Search completes but no roads appear

**Solutions:**
1. Try lowering the minimum curvature threshold
2. Change the surface filter to "All Surfaces"
3. Increase the result limit
4. Check browser console for GeoJSON parsing errors
5. Verify the backend is returning valid GeoJSON

### Segments Not Connecting
**Problem:** "Segments must connect!" error when building routes

**Cause:** You're trying to add a segment that doesn't touch the end of your current route

**Solution:** Click only segments that connect to the end of your route. Look for roads that share an endpoint with your last selected segment.

### Session Lost on Refresh
**Problem:** Saved routes disappear after page reload

**Solutions:**
1. Check if localStorage is enabled in your browser
2. Check browser console for localStorage errors
3. Try in incognito mode to rule out extension interference
4. Clear cache and reload

### Build Errors
**Problem:** TypeScript or build errors

**Solutions:**
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Clear Next.js cache: `rm -rf .next`
4. Run `npm run build` to see detailed errors

## API Endpoints Used

The frontend communicates with these backend endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/config` | GET | Get Mapbox API token |
| `/data/load?filepath=X` | POST | Load msgpack file |
| `/roads/geojson?min_curvature=X&surface=Y&limit=Z` | GET | Search roads |
| `/roads/segments?min_curvature=X&limit=Y` | GET | Load segments |
| `/sessions/create` | POST | Create user session |
| `/routes/save?session_id=X` | POST | Save route |
| `/routes/list?session_id=X` | GET | List saved routes |
| `/routes/:slug` | GET | View route |
| `/routes/:id?session_id=X` | DELETE | Delete route |
| `/routes/:slug/export/:format` | GET | Export route |

Make sure all these endpoints are working on your backend before testing the frontend.

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Older browsers may not support all features (particularly Mapbox GL JS).

## Performance Tips

1. **Limit Results**: Start with 100 roads max, increase if needed
2. **Filter by Surface**: Use "Paved Only" to reduce data
3. **Higher Curvature**: Set min curvature to 500+ to filter out straight roads
4. **Clear Old Data**: Switch modes or reload to clear previous searches

## Next Steps

Once everything is working:

1. Consider deploying to Vercel/Netlify
2. Set up proper environment variables for production
3. Configure CORS on backend for production domain
4. Add analytics if desired
5. Set up error tracking (Sentry, etc.)
6. Consider adding route search functionality
7. Add mobile-responsive improvements
8. Implement offline support with service workers

## Support

If you encounter issues:

1. Check browser console for errors
2. Check backend logs
3. Verify all API endpoints are working with curl/Postman
4. Review the MIGRATION_SUMMARY.md for architecture details
5. Check the backend configuration matches the requirements above
