# GPX and KML Export Service

Enhanced export functionality for B-Road routes with elevation data and dense waypoints for accurate GPS navigation.

## Features

### GPX Export (`.gpx`)
- **Dense waypoints**: ~30 points per mile for accurate navigation
- **Elevation data**: Fetched from Open-Elevation API
- **GPX 1.1 standard**: Compatible with all modern GPS devices and apps
- **Optimized precision**: 6 decimal places (~0.1m accuracy) for smaller file sizes
- **Rich metadata**: Creator, name, description, curvature stats

### KML Export (`.kml`)
- **Google Earth compatible**: Works with Google Earth, Maps, etc.
- **Dynamic styling**: Line color based on curvature intensity
- **Rich descriptions**: Embedded route statistics and metadata
- **Tessellation**: Follows terrain for 3D visualization

## API Endpoints

### Export GPX
```
GET /routes/{route_identifier}/export/gpx
```

Returns a GPX 1.1 file with dense track points and elevation data.

**Example:**
```bash
curl -o route.gpx "http://localhost:8000/routes/vermont-loop-abc123/export/gpx"
```

### Export KML
```
GET /routes/{route_identifier}/export/kml
```

Returns a KML file with styling and metadata.

**Example:**
```bash
curl -o route.kml "http://localhost:8000/routes/vermont-loop-abc123/export/kml"
```

## Technical Details

### Route Densification

Routes are densified using Shapely's `segmentize()` method (equivalent to PostGIS `ST_Segmentize`):

```python
METERS_PER_MILE = 1609.34
TARGET_POINTS_PER_MILE = 30
DENSIFY_DISTANCE_METERS = 53.6  # ~30 points per mile
```

This ensures GPS devices have enough waypoints to accurately follow the route, especially around curves.

### Elevation Data

Elevations are fetched from the [Open-Elevation API](https://open-elevation.com/):
- **Free and open source**: No API key required
- **Batch requests**: Up to 100 points per request
- **Graceful fallback**: If API fails, GPX is still generated without elevations
- **Caching**: Results are batched to minimize API calls

**Alternative APIs** (can be configured in `export_service.py`):
- Mapbox Terrain API (requires API key)
- Google Elevation API (requires API key, $)
- USGS Elevation Point Query Service (US only)

### Coordinate Precision

Coordinates are rounded to 6 decimal places:
- **Accuracy**: ~0.1 meters (sufficient for navigation)
- **File size**: Reduces GPX files by ~30% compared to full precision
- **Standard**: Matches GPS device precision

| Decimal Places | Accuracy |
|---------------|----------|
| 4 | ~11 m |
| 5 | ~1.1 m |
| 6 | ~0.11 m |
| 7 | ~0.011 m |

### GPX Metadata

Generated GPX files include:
```xml
<gpx version="1.1" creator="B-Road GPX Optimizer">
  <metadata>
    <name>Route Name</name>
    <desc>Curvature: 500, Distance: 25.3 mi</desc>
    <author>
      <name>B-Road</name>
      <link href="https://github.com/adamfranco/curvature">
        <text>Curvature Project</text>
      </link>
    </author>
    <time>2024-01-15T10:30:00Z</time>
  </metadata>
  <trk>
    <name>Route Name</name>
    <type>Scenic Drive</type>
    <cmt>Total Distance: 25.30 mi | Curvature Score: 500 | Segments: 42</cmt>
    <trkseg>
      <trkpt lat="44.000000" lon="-72.500000">
        <ele>305.5</ele>
      </trkpt>
      ...
    </trkseg>
  </trk>
</gpx>
```

## Installation

1. Install dependencies:
```bash
cd api
pip install -r requirements.txt
```

2. For testing:
```bash
pip install -r requirements-test.txt
```

## Testing

Run the comprehensive test suite:

```bash
# All tests
pytest test_export_service.py -v

# With coverage
pytest test_export_service.py --cov=export_service --cov-report=html

# Specific test
pytest test_export_service.py::TestExportService::test_densify_route_points -v
```

### Test Coverage

The test suite covers:
- ✅ Route retrieval (by ID and slug)
- ✅ Route densification (~30 points/mile)
- ✅ Elevation API integration (success and failure cases)
- ✅ GPX structure and metadata validation
- ✅ Coordinate precision verification
- ✅ KML generation and styling
- ✅ Error handling (missing routes, API failures)

## Usage in Code

```python
from api.export_service import ExportService
from api.database import get_db

# Generate GPX
with get_db() as db:
    service = ExportService(db)
    gpx_xml = await service.generate_gpx_track("route-slug-123")

    with open("route.gpx", "w") as f:
        f.write(gpx_xml)

# Generate KML
with get_db() as db:
    service = ExportService(db)
    kml_xml = service.generate_kml("route-slug-123")

    with open("route.kml", "w") as f:
        f.write(kml_xml)
```

## Performance

### GPX Generation
- **Short route** (5-10 mi): ~2-3 seconds
- **Medium route** (20-30 mi): ~5-8 seconds
- **Long route** (50+ mi): ~10-15 seconds

Timing breakdown:
- Route densification: ~0.1s
- Elevation API calls: ~2-10s (depends on route length)
- GPX generation: ~0.1s

### Optimization Tips

1. **Adjust densification**: Lower `TARGET_POINTS_PER_MILE` for faster generation
2. **Cache elevations**: Store elevation data in database for frequently exported routes
3. **Batch exports**: Process multiple routes in parallel with `asyncio.gather()`

## Troubleshooting

### Elevation API Not Responding

If Open-Elevation API is down, GPX files will still be generated without elevation data:

```
WARNING: Failed to fetch elevation batch 1: Connection timeout
INFO: Generated GPX for route 123: 150 points, 0 with elevation data
```

**Solutions:**
1. Use alternative API (configure in `export_service.py`)
2. Pre-fetch and cache elevation data in database
3. Increase timeout: `ELEVATION_TIMEOUT = 60`

### Route Too Dense / File Too Large

For very long routes (100+ miles), GPX files can become large (>5 MB):

**Solutions:**
1. Reduce `TARGET_POINTS_PER_MILE` (try 20 instead of 30)
2. Implement route splitting (break into multiple segments)
3. Use compression (gzip GPX files)

### Import Errors

```
ImportError: No module named 'api.export_service'
```

**Solution:** Ensure you're running from project root and `api/` is in Python path:
```bash
export PYTHONPATH=/path/to/b-road-gpx-optimization:$PYTHONPATH
python -m pytest api/test_export_service.py
```

## Future Enhancements

- [ ] Cache elevation data in database
- [ ] Support for route waypoints (start/end markers)
- [ ] GPX route (not just track) generation for navigation apps
- [ ] Turn-by-turn navigation hints
- [ ] TCX export for cycling computers
- [ ] FIT export for Garmin devices
- [ ] Strava API integration
- [ ] Async background export with progress tracking

## References

- [GPX 1.1 Schema](https://www.topografix.com/GPX/1/1/)
- [KML Reference](https://developers.google.com/kml/documentation/kmlreference)
- [Open-Elevation API](https://open-elevation.com/)
- [PostGIS ST_Segmentize](https://postgis.net/docs/ST_Segmentize.html)
