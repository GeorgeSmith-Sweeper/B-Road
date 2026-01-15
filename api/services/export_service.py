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

        # Add points
        for seg in sorted(route.segments, key=lambda s: s.position):
            if seg.position == 1:
                gpx_segment.points.append(
                    gpxpy.gpx.GPXTrackPoint(seg.start_lat, seg.start_lon)
                )
            gpx_segment.points.append(gpxpy.gpx.GPXTrackPoint(seg.end_lat, seg.end_lon))

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
Curvature: {route.total_curvature:.0f}
Distance: {route.total_length / 1609.34:.1f} mi ({route.total_length / 1000:.1f} km)
Segments: {route.segment_count}
      </description>
      <styleUrl>#route-style</styleUrl>
      <LineString>
        <coordinates>
"""

        # Add coordinates
        for seg in sorted(route.segments, key=lambda s: s.position):
            if seg.position == 1:
                kml += f"{seg.start_lon},{seg.start_lat},0\n"
            kml += f"{seg.end_lon},{seg.end_lat},0\n"

        kml += """        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>"""

        filename = f"{route.url_slug}.kml"
        return kml, filename
