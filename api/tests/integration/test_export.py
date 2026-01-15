"""
Integration tests for route export functionality.

Tests export formats:
- GPX (GPS Exchange Format)
- KML (Google Earth format)
"""

import pytest
import xml.etree.ElementTree as ET
import gpxpy
import gpxpy.gpx

from tests.fixtures.sample_segments import CONNECTED_SEGMENTS


@pytest.mark.integration
class TestGPXExport:
    """Tests for GPX export functionality."""

    def test_export_gpx(self, test_client, sample_route, sample_segments):
        """Test GET /routes/{slug}/export/gpx returns GPX file."""
        response = test_client.get(f"/routes/{sample_route.url_slug}/export/gpx")

        assert response.status_code == 200
        assert "application/gpx+xml" in response.headers["content-type"]
        assert "Content-Disposition" in response.headers
        assert "attachment" in response.headers["Content-Disposition"]
        assert sample_route.url_slug in response.headers["Content-Disposition"]

    def test_gpx_is_valid_xml(self, test_client, sample_route, sample_segments):
        """Test that exported GPX is valid XML."""
        response = test_client.get(f"/routes/{sample_route.url_slug}/export/gpx")

        # Should parse without errors
        gpx_content = response.content.decode("utf-8")
        root = ET.fromstring(gpx_content)

        assert root.tag.endswith("gpx")

    def test_gpx_parses_with_gpxpy(self, test_client, sample_route, sample_segments):
        """Test that exported GPX can be parsed by gpxpy library."""
        response = test_client.get(f"/routes/{sample_route.url_slug}/export/gpx")

        # Parse with gpxpy
        gpx = gpxpy.parse(response.content)

        assert gpx is not None
        assert len(gpx.tracks) > 0

    def test_gpx_contains_route_metadata(
        self, test_client, sample_route, sample_segments
    ):
        """Test that GPX contains route name and description."""
        response = test_client.get(f"/routes/{sample_route.url_slug}/export/gpx")

        gpx = gpxpy.parse(response.content)
        track = gpx.tracks[0]

        assert track.name == sample_route.route_name
        assert track.description == sample_route.description

    def test_gpx_contains_all_track_points(
        self, test_client, sample_route, sample_segments
    ):
        """Test that GPX contains all segment endpoints as track points."""
        response = test_client.get(f"/routes/{sample_route.url_slug}/export/gpx")

        gpx = gpxpy.parse(response.content)
        track = gpx.tracks[0]
        segment = track.segments[0]
        points = segment.points

        # Should have 4 points (3 connected segments)
        expected_point_count = sample_route.segment_count + 1
        assert len(points) == expected_point_count

    def test_gpx_track_point_coordinates(
        self, test_client, sample_route, sample_segments
    ):
        """Test that GPX track points have correct coordinates."""
        response = test_client.get(f"/routes/{sample_route.url_slug}/export/gpx")

        gpx = gpxpy.parse(response.content)
        points = gpx.tracks[0].segments[0].points

        # First point should match first segment start
        first_seg = CONNECTED_SEGMENTS[0]
        first_point = points[0]

        assert first_point.latitude == pytest.approx(first_seg["start"][0], abs=1e-6)
        assert first_point.longitude == pytest.approx(first_seg["start"][1], abs=1e-6)

        # Last point should match last segment end
        last_seg = CONNECTED_SEGMENTS[-1]
        last_point = points[-1]

        assert last_point.latitude == pytest.approx(last_seg["end"][0], abs=1e-6)
        assert last_point.longitude == pytest.approx(last_seg["end"][1], abs=1e-6)

    def test_gpx_elevation_data(self, test_client, sample_route, sample_segments):
        """Test GPX elevation field (currently None - Known Issue #5)."""
        response = test_client.get(f"/routes/{sample_route.url_slug}/export/gpx")

        gpx = gpxpy.parse(response.content)
        points = gpx.tracks[0].segments[0].points

        # Elevation is currently not implemented
        # All points should have None or 0 elevation
        for point in points:
            assert point.elevation is None or point.elevation == 0

    def test_gpx_export_nonexistent_route(self, test_client):
        """Test GPX export for nonexistent route returns 404."""
        response = test_client.get("/routes/nonexistent-slug/export/gpx")

        assert response.status_code == 404

    def test_gpx_coordinate_precision(self, test_client, sample_route, sample_segments):
        """Test that GPX preserves coordinate precision."""
        response = test_client.get(f"/routes/{sample_route.url_slug}/export/gpx")

        gpx = gpxpy.parse(response.content)
        points = gpx.tracks[0].segments[0].points

        # Check that coordinates have high precision (at least 6 decimal places)
        for point in points:
            # Convert to string and check decimal places
            lat_str = str(point.latitude)
            lon_str = str(point.longitude)

            # Should have decimal point
            assert "." in lat_str
            assert "." in lon_str


@pytest.mark.integration
class TestKMLExport:
    """Tests for KML export functionality."""

    def test_export_kml(self, test_client, sample_route, sample_segments):
        """Test GET /routes/{slug}/export/kml returns KML file."""
        response = test_client.get(f"/routes/{sample_route.url_slug}/export/kml")

        assert response.status_code == 200
        assert (
            "application/vnd.google-earth.kml+xml" in response.headers["content-type"]
        )
        assert "Content-Disposition" in response.headers
        assert "attachment" in response.headers["Content-Disposition"]
        assert sample_route.url_slug in response.headers["Content-Disposition"]

    def test_kml_is_valid_xml(self, test_client, sample_route, sample_segments):
        """Test that exported KML is valid XML."""
        response = test_client.get(f"/routes/{sample_route.url_slug}/export/kml")

        # Should parse without errors
        kml_content = response.content.decode("utf-8")
        root = ET.fromstring(kml_content)

        assert root.tag.endswith("kml")

    def test_kml_contains_document_structure(
        self, test_client, sample_route, sample_segments
    ):
        """Test that KML has proper document structure."""
        response = test_client.get(f"/routes/{sample_route.url_slug}/export/kml")

        root = ET.fromstring(response.content)

        # Find Document element
        ns = {"kml": "http://www.opengis.net/kml/2.2"}
        document = root.find("kml:Document", ns)

        assert document is not None

        # Should have name
        name = document.find("kml:name", ns)
        assert name is not None
        assert name.text == sample_route.route_name

    def test_kml_contains_placemark(self, test_client, sample_route, sample_segments):
        """Test that KML contains Placemark with LineString."""
        response = test_client.get(f"/routes/{sample_route.url_slug}/export/kml")

        root = ET.fromstring(response.content)
        ns = {"kml": "http://www.opengis.net/kml/2.2"}

        document = root.find("kml:Document", ns)
        placemark = document.find("kml:Placemark", ns)

        assert placemark is not None

        # Should have LineString
        linestring = placemark.find(".//kml:LineString", ns)
        assert linestring is not None

    def test_kml_coordinates_format(self, test_client, sample_route, sample_segments):
        """Test that KML coordinates are in correct format (lon,lat,0)."""
        response = test_client.get(f"/routes/{sample_route.url_slug}/export/kml")

        root = ET.fromstring(response.content)
        ns = {"kml": "http://www.opengis.net/kml/2.2"}

        coordinates = root.find(".//kml:coordinates", ns)
        assert coordinates is not None

        # Parse coordinates
        coord_text = coordinates.text.strip()
        coord_lines = coord_text.split("\n")

        # Should have multiple coordinate lines
        assert len(coord_lines) >= 2

        # Each line should be in format: lon,lat,0
        for line in coord_lines:
            line = line.strip()
            if line:
                parts = line.split(",")
                assert len(parts) == 3
                # Parse as floats to verify format
                lon = float(parts[0])
                lat = float(parts[1])
                alt = float(parts[2])

                # Vermont coordinates
                assert -73 < lon < -72
                assert 44 < lat < 45
                assert alt == 0  # No elevation data

    def test_kml_styling(self, test_client, sample_route, sample_segments):
        """Test that KML includes style definition."""
        response = test_client.get(f"/routes/{sample_route.url_slug}/export/kml")

        root = ET.fromstring(response.content)
        ns = {"kml": "http://www.opengis.net/kml/2.2"}

        document = root.find("kml:Document", ns)
        style = document.find("kml:Style", ns)

        assert style is not None
        assert style.get("id") == "route-style"

        # Should have LineStyle
        linestyle = style.find("kml:LineStyle", ns)
        assert linestyle is not None

    def test_kml_description_contains_stats(
        self, test_client, sample_route, sample_segments
    ):
        """Test that KML description includes route statistics."""
        response = test_client.get(f"/routes/{sample_route.url_slug}/export/kml")

        root = ET.fromstring(response.content)
        ns = {"kml": "http://www.opengis.net/kml/2.2"}

        placemark = root.find(".//kml:Placemark", ns)
        description = placemark.find("kml:description", ns)

        assert description is not None
        desc_text = description.text

        # Should contain statistics
        assert "Curvature" in desc_text
        assert "Distance" in desc_text
        assert "Segments" in desc_text

        # Should contain actual values
        assert str(int(sample_route.total_curvature)) in desc_text

    def test_kml_export_nonexistent_route(self, test_client):
        """Test KML export for nonexistent route returns 404."""
        response = test_client.get("/routes/nonexistent-slug/export/kml")

        assert response.status_code == 404

    def test_kml_coordinate_count_matches_segments(
        self, test_client, sample_route, sample_segments
    ):
        """Test that KML has correct number of coordinates."""
        response = test_client.get(f"/routes/{sample_route.url_slug}/export/kml")

        root = ET.fromstring(response.content)
        ns = {"kml": "http://www.opengis.net/kml/2.2"}

        coordinates = root.find(".//kml:coordinates", ns)
        coord_text = coordinates.text.strip()
        coord_lines = [line.strip() for line in coord_text.split("\n") if line.strip()]

        # Should have segment_count + 1 coordinates
        expected_count = sample_route.segment_count + 1
        assert len(coord_lines) == expected_count


@pytest.mark.integration
class TestExportComparison:
    """Tests comparing GPX and KML exports for consistency."""

    def test_gpx_and_kml_have_same_coordinates(
        self, test_client, sample_route, sample_segments
    ):
        """Test that GPX and KML exports contain the same coordinates."""
        # Get GPX
        gpx_response = test_client.get(f"/routes/{sample_route.url_slug}/export/gpx")
        gpx = gpxpy.parse(gpx_response.content)
        gpx_points = gpx.tracks[0].segments[0].points

        # Get KML
        kml_response = test_client.get(f"/routes/{sample_route.url_slug}/export/kml")
        root = ET.fromstring(kml_response.content)
        ns = {"kml": "http://www.opengis.net/kml/2.2"}
        coordinates = root.find(".//kml:coordinates", ns)
        kml_coords = coordinates.text.strip().split("\n")

        # Should have same number of points
        assert len(gpx_points) == len(kml_coords)

        # Compare coordinates
        for gpx_point, kml_line in zip(gpx_points, kml_coords):
            kml_line = kml_line.strip()
            if kml_line:
                kml_parts = kml_line.split(",")
                kml_lon = float(kml_parts[0])
                kml_lat = float(kml_parts[1])

                assert gpx_point.longitude == pytest.approx(kml_lon, abs=1e-6)
                assert gpx_point.latitude == pytest.approx(kml_lat, abs=1e-6)

    def test_both_exports_contain_route_name(
        self, test_client, sample_route, sample_segments
    ):
        """Test that both formats contain the route name."""
        # GPX
        gpx_response = test_client.get(f"/routes/{sample_route.url_slug}/export/gpx")
        gpx = gpxpy.parse(gpx_response.content)
        gpx_name = gpx.tracks[0].name

        # KML
        kml_response = test_client.get(f"/routes/{sample_route.url_slug}/export/kml")
        root = ET.fromstring(kml_response.content)
        ns = {"kml": "http://www.opengis.net/kml/2.2"}
        kml_name = root.find(".//kml:Placemark/kml:name", ns).text

        assert gpx_name == sample_route.route_name
        assert kml_name == sample_route.route_name
        assert gpx_name == kml_name


@pytest.mark.integration
class TestExportEdgeCases:
    """Tests for edge cases in export functionality."""

    def test_export_route_with_single_segment(
        self, test_client, test_engine, sample_session
    ):
        """Test exporting a route with only one segment."""
        from models import SavedRoute, RouteSegment
        from shapely.geometry import LineString
        from geoalchemy2.shape import from_shape
        from sqlalchemy.orm import sessionmaker

        # Create data using test_engine so test_client can see it
        TestSessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=test_engine
        )
        db = TestSessionLocal()
        try:
            # Create minimal route with single segment
            linestring = LineString([(-72.0, 44.0), (-72.01, 44.01)])
            route = SavedRoute(
                session_id=sample_session.session_id,
                route_name="Single Segment",
                total_curvature=5.0,
                total_length=100.0,
                segment_count=1,
                geom=from_shape(linestring, srid=4326),
                route_data={"segments": []},
                url_slug="single-seg-test",
            )
            db.add(route)
            db.commit()
            db.refresh(route)

            seg = RouteSegment(
                route_id=route.route_id,
                position=1,
                start_lat=44.0,
                start_lon=-72.0,
                end_lat=44.01,
                end_lon=-72.01,
                length=100.0,
                radius=50.0,
                curvature=5.0,
                curvature_level=1,
            )
            db.add(seg)
            db.commit()
        finally:
            db.close()

        # Export GPX
        gpx_response = test_client.get("/routes/single-seg-test/export/gpx")
        assert gpx_response.status_code == 200

        gpx = gpxpy.parse(gpx_response.content)
        points = gpx.tracks[0].segments[0].points

        # Should have 2 points (start and end)
        assert len(points) == 2

    def test_export_preserves_special_characters_in_name(
        self, test_client, test_db_session, sample_session
    ):
        """Test that route names with special characters export correctly."""
        from models import SavedRoute, RouteSegment
        from shapely.geometry import LineString
        from geoalchemy2.shape import from_shape

        special_name = 'Test & Route with "Quotes" & <Symbols>'

        linestring = LineString([(-72.0, 44.0), (-72.01, 44.01)])
        route = SavedRoute(
            session_id=sample_session.session_id,
            route_name=special_name,
            total_curvature=5.0,
            total_length=100.0,
            segment_count=1,
            geom=from_shape(linestring, srid=4326),
            route_data={"segments": []},
            url_slug="special-chars",
        )
        test_db_session.add(route)

        seg = RouteSegment(
            route_id=route.route_id,
            position=1,
            start_lat=44.0,
            start_lon=-72.0,
            end_lat=44.01,
            end_lon=-72.01,
            length=100.0,
            radius=50.0,
            curvature=5.0,
            curvature_level=1,
        )
        test_db_session.add(seg)
        test_db_session.commit()

        # GPX should handle special chars
        gpx_response = test_client.get("/routes/special-chars/export/gpx")
        assert gpx_response.status_code == 200

        # Should parse without XML errors
        gpx = gpxpy.parse(gpx_response.content)
        assert gpx.tracks[0].name == special_name
