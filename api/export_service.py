"""
Export service for generating GPX and KML files from saved routes.

Features:
- Dense track points (~30 per mile) for accurate navigation
- Elevation data from Open-Elevation API
- Optimized coordinate precision (6 decimal places = ~0.1m accuracy)
- Proper GPX 1.1 metadata
- KML export with styling
"""

import logging
from typing import List, Tuple, Optional, Dict
from datetime import datetime
import httpx
import gpxpy
import gpxpy.gpx
from sqlalchemy.orm import Session
from geoalchemy2.shape import to_shape
from shapely.geometry import LineString

from api.models import SavedRoute

logger = logging.getLogger(__name__)

# Elevation API configuration
OPEN_ELEVATION_API = "https://api.open-elevation.com/api/v1/lookup"
ELEVATION_BATCH_SIZE = 100  # Max points per API request
ELEVATION_TIMEOUT = 30  # seconds

# Densification settings
METERS_PER_MILE = 1609.34
TARGET_POINTS_PER_MILE = 30
DENSIFY_DISTANCE_METERS = METERS_PER_MILE / TARGET_POINTS_PER_MILE  # ~53.6m between points

# Coordinate precision (6 decimal places = ~0.1m accuracy)
COORD_PRECISION = 6


class ExportService:
    """Service for exporting routes to various formats."""

    def __init__(self, db_session: Session):
        self.db = db_session

    def get_route(self, route_identifier: str) -> Optional[SavedRoute]:
        """
        Get route by ID or URL slug.

        Args:
            route_identifier: Route ID (integer) or URL slug (string)

        Returns:
            SavedRoute object or None if not found
        """
        # Try as URL slug first
        route = self.db.query(SavedRoute).filter_by(url_slug=route_identifier).first()

        # Try as route_id
        if not route:
            try:
                route_id = int(route_identifier)
                route = self.db.query(SavedRoute).filter_by(route_id=route_id).first()
            except ValueError:
                pass

        return route

    def densify_route_points(self, route: SavedRoute) -> List[Tuple[float, float]]:
        """
        Densify route geometry to ~30 points per mile for accurate navigation.

        Uses PostGIS ST_Segmentize to add intermediate points along the route.

        Args:
            route: SavedRoute object with geometry

        Returns:
            List of (lon, lat) coordinate tuples
        """
        # Convert GeoAlchemy2 geometry to Shapely
        linestring = to_shape(route.geom)

        # Calculate total length for logging
        total_length_miles = route.total_length / METERS_PER_MILE

        # Densify using Shapely's segmentize (similar to PostGIS ST_Segmentize)
        # Note: Shapely works in the same units as the coordinates (degrees for WGS84)
        # We need to convert meters to degrees approximately
        # At equator: 1 degree ≈ 111km, so we use a rough conversion
        densify_distance_degrees = DENSIFY_DISTANCE_METERS / 111000

        densified = linestring.segmentize(densify_distance_degrees)

        # Extract coordinates as (lon, lat) tuples
        coords = [(round(x, COORD_PRECISION), round(y, COORD_PRECISION))
                  for x, y in densified.coords]

        logger.info(f"Densified route {route.route_id}: {len(linestring.coords)} -> {len(coords)} points "
                   f"({total_length_miles:.1f} mi, {len(coords)/total_length_miles:.1f} pts/mi)")

        return coords

    async def fetch_elevations(self, coordinates: List[Tuple[float, float]]) -> Dict[Tuple[float, float], float]:
        """
        Fetch elevation data from Open-Elevation API.

        Batches requests to avoid API limits. Falls back gracefully if API fails.

        Args:
            coordinates: List of (lon, lat) tuples

        Returns:
            Dictionary mapping (lon, lat) -> elevation (meters)
        """
        elevations = {}

        if not coordinates:
            return elevations

        try:
            async with httpx.AsyncClient(timeout=ELEVATION_TIMEOUT) as client:
                # Process in batches
                for i in range(0, len(coordinates), ELEVATION_BATCH_SIZE):
                    batch = coordinates[i:i + ELEVATION_BATCH_SIZE]

                    # Open-Elevation expects {"locations": [{"latitude": y, "longitude": x}, ...]}
                    locations = [{"latitude": lat, "longitude": lon} for lon, lat in batch]

                    try:
                        response = await client.post(
                            OPEN_ELEVATION_API,
                            json={"locations": locations},
                            timeout=ELEVATION_TIMEOUT
                        )
                        response.raise_for_status()

                        data = response.json()

                        # Map results back to coordinates
                        for coord, result in zip(batch, data.get("results", [])):
                            elevation = result.get("elevation")
                            if elevation is not None:
                                elevations[coord] = round(elevation, 1)

                        logger.info(f"Fetched elevations for batch {i//ELEVATION_BATCH_SIZE + 1}: "
                                  f"{len(elevations)} points")

                    except (httpx.HTTPError, KeyError, ValueError) as e:
                        logger.warning(f"Failed to fetch elevation batch {i//ELEVATION_BATCH_SIZE + 1}: {e}")
                        continue

        except Exception as e:
            logger.error(f"Elevation API error: {e}")

        return elevations

    async def generate_gpx_track(self, route_identifier: str) -> Optional[str]:
        """
        Generate GPX 1.1 track with elevation data and dense waypoints.

        Args:
            route_identifier: Route ID or URL slug

        Returns:
            GPX XML string or None if route not found
        """
        route = self.get_route(route_identifier)
        if not route:
            return None

        # Densify route geometry
        coordinates = self.densify_route_points(route)

        # Fetch elevation data
        elevations = await self.fetch_elevations(coordinates)

        # Create GPX object
        gpx = gpxpy.gpx.GPX()

        # Add metadata
        gpx.name = route.route_name
        gpx.description = route.description or f"Curvature: {route.total_curvature:.0f}, Distance: {route.length_mi:.1f} mi"
        gpx.creator = "B-Road GPX Optimizer - https://github.com/adamfranco/curvature"
        gpx.time = datetime.utcnow()

        # Add metadata extension
        gpx.author_name = "B-Road"
        gpx.author_link = "https://github.com/adamfranco/curvature"
        gpx.author_link_text = "Curvature Project"

        # Create track
        gpx_track = gpxpy.gpx.GPXTrack()
        gpx_track.name = route.route_name
        gpx_track.description = route.description
        gpx_track.type = "Scenic Drive"

        # Add track statistics as comment
        gpx_track.comment = (
            f"Total Distance: {route.length_mi:.2f} mi ({route.length_km:.2f} km) | "
            f"Curvature Score: {route.total_curvature:.0f} | "
            f"Segments: {route.segment_count}"
        )

        gpx.tracks.append(gpx_track)

        # Create track segment with all densified points
        gpx_segment = gpxpy.gpx.GPXTrackSegment()
        gpx_track.segments.append(gpx_segment)

        # Add points with elevation
        for lon, lat in coordinates:
            elevation = elevations.get((lon, lat))

            point = gpxpy.gpx.GPXTrackPoint(
                latitude=lat,
                longitude=lon,
                elevation=elevation,
                time=None  # No timestamps for route tracks
            )

            gpx_segment.points.append(point)

        logger.info(f"Generated GPX for route {route.route_id}: {len(coordinates)} points, "
                   f"{len(elevations)} with elevation data")

        # Generate XML with proper formatting
        return gpx.to_xml(version="1.1")

    def generate_kml(self, route_identifier: str) -> Optional[str]:
        """
        Generate KML file with elevation and styling.

        Args:
            route_identifier: Route ID or URL slug

        Returns:
            KML XML string or None if route not found
        """
        route = self.get_route(route_identifier)
        if not route:
            return None

        # Build coordinate string (lon,lat,elevation format)
        coords_list = []
        for seg in sorted(route.segments, key=lambda s: s.position):
            if seg.position == 1:
                coords_list.append(f"{seg.start_lon},{seg.start_lat},0")
            coords_list.append(f"{seg.end_lon},{seg.end_lat},0")

        coordinates = "\n".join(coords_list)

        # Calculate route statistics
        curvature_per_mile = route.total_curvature / route.length_mi if route.length_mi > 0 else 0

        # Determine line color based on curvature (AABBGGRR format for KML)
        if curvature_per_mile > 200:
            line_color = "ff0000ff"  # Red - very curvy
        elif curvature_per_mile > 100:
            line_color = "ff0099ff"  # Orange - curvy
        else:
            line_color = "ffff0000"  # Blue - moderate

        # Build KML with enhanced metadata
        kml = f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>{route.route_name}</name>
    <description><![CDATA[
      <h2>{route.route_name}</h2>
      <p>{route.description or 'Scenic driving route'}</p>
      <table>
        <tr><td><b>Distance:</b></td><td>{route.length_mi:.2f} mi ({route.length_km:.2f} km)</td></tr>
        <tr><td><b>Curvature:</b></td><td>{route.total_curvature:.0f} ({curvature_per_mile:.0f}/mi)</td></tr>
        <tr><td><b>Segments:</b></td><td>{route.segment_count}</td></tr>
        <tr><td><b>Created:</b></td><td>{route.created_at.strftime('%Y-%m-%d')}</td></tr>
      </table>
      <p><i>Generated by B-Road GPX Optimizer</i></p>
    ]]></description>

    <Style id="route-style">
      <LineStyle>
        <color>{line_color}</color>
        <width>4</width>
        <gx:labelVisibility>1</gx:labelVisibility>
      </LineStyle>
      <PolyStyle>
        <color>40{line_color[2:]}</color>
      </PolyStyle>
    </Style>

    <Placemark>
      <name>{route.route_name}</name>
      <description><![CDATA[
        Distance: {route.length_mi:.2f} mi ({route.length_km:.2f} km)<br/>
        Curvature: {route.total_curvature:.0f} total, {curvature_per_mile:.0f} per mile<br/>
        Segments: {route.segment_count}
      ]]></description>
      <styleUrl>#route-style</styleUrl>
      <LineString>
        <extrude>0</extrude>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>
{coordinates}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>"""

        logger.info(f"Generated KML for route {route.route_id}: {len(coords_list)} points")

        return kml


# Convenience functions for FastAPI endpoints
async def generate_gpx_for_route(db: Session, route_identifier: str) -> Optional[str]:
    """
    Generate GPX track for a route.

    Args:
        db: Database session
        route_identifier: Route ID or URL slug

    Returns:
        GPX XML string or None if route not found
    """
    service = ExportService(db)
    return await service.generate_gpx_track(route_identifier)


def generate_kml_for_route(db: Session, route_identifier: str) -> Optional[str]:
    """
    Generate KML for a route.

    Args:
        db: Database session
        route_identifier: Route ID or URL slug

    Returns:
        KML XML string or None if route not found
    """
    service = ExportService(db)
    return service.generate_kml(route_identifier)
