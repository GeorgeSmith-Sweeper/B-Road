"""
Service for exporting routes to various formats (GPX, KML).
"""

from sqlalchemy.orm import Session
import gpxpy
import gpxpy.gpx

from api.repositories.route_repository import RouteRepository


class ExportService:
    """Service for route export operations."""

    def __init__(self, db: Session):
        self.db = db
        self.route_repo = RouteRepository(db)

    def _get_route_coordinates(self, route) -> list[tuple[float, float]]:
        """
        Get route coordinates as list of (lon, lat) tuples.

        For waypoint routes, uses the connecting geometry (full OSRM road-snapped path).
        For segment-list routes, uses segment start/end points.
        """
        route_type = getattr(route, "route_type", None) or "segment_list"

        if route_type == "waypoint":
            connecting_geo = (route.route_data or {}).get("connecting_geometry", {})
            coords = connecting_geo.get("coordinates", [])
            if coords:
                return [(c[0], c[1]) for c in coords]
            # Fallback to waypoint positions
            return [
                (wp.lng, wp.lat)
                for wp in sorted(route.waypoints, key=lambda w: w.waypoint_order)
            ]
        else:
            coords = []
            for seg in sorted(route.segments, key=lambda s: s.position):
                if seg.position == 1:
                    coords.append((seg.start_lon, seg.start_lat))
                coords.append((seg.end_lon, seg.end_lat))
            return coords

    def export_gpx(self, identifier: str) -> tuple[str, str]:
        """
        Export route as GPX file.

        Returns:
            tuple: (gpx_xml_content, filename)
        """
        route = self.route_repo.get_by_id_or_slug(identifier)
        if not route:
            raise ValueError("Route not found")

        # Create GPX
        gpx = gpxpy.gpx.GPX()

        # Create track
        gpx_track = gpxpy.gpx.GPXTrack()
        gpx_track.name = route.route_name
        gpx_track.description = route.description
        gpx.tracks.append(gpx_track)

        # Create segment
        gpx_segment = gpxpy.gpx.GPXTrackSegment()
        gpx_track.segments.append(gpx_segment)

        # Add points from coordinates (lon, lat) -> GPXTrackPoint(lat, lon)
        for lon, lat in self._get_route_coordinates(route):
            gpx_segment.points.append(gpxpy.gpx.GPXTrackPoint(lat, lon))

        gpx_xml = gpx.to_xml()
        filename = f"{route.url_slug}.gpx"

        return gpx_xml, filename

    def export_kml(self, identifier: str) -> tuple[str, str]:
        """
        Export route as KML file.

        Returns:
            tuple: (kml_xml_content, filename)
        """
        route = self.route_repo.get_by_id_or_slug(identifier)
        if not route:
            raise ValueError("Route not found")

        total_curvature = route.total_curvature or 0
        total_length = route.total_length or 0

        # Build KML
        kml = f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>{route.route_name}</name>
    <description>{route.description or ''}</description>
    <Style id="route-style">
      <LineStyle>
        <color>ff0000ff</color>
        <width>4</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>{route.route_name}</name>
      <description>
Curvature: {total_curvature:.0f}
Distance: {total_length / 1609.34:.1f} mi ({total_length / 1000:.1f} km)
Segments: {route.segment_count}
      </description>
      <styleUrl>#route-style</styleUrl>
      <LineString>
        <coordinates>
"""

        # Add coordinates
        for lon, lat in self._get_route_coordinates(route):
            kml += f"{lon},{lat},0\n"

        kml += """        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>"""

        filename = f"{route.url_slug}.kml"
        return kml, filename
