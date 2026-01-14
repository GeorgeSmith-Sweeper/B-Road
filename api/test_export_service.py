"""
Unit tests for export_service.py

Tests GPX and KML generation with various scenarios:
- Route densification
- Elevation API integration
- Coordinate precision
- Metadata generation
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
import gpxpy
import xml.etree.ElementTree as ET

from api.export_service import ExportService, DENSIFY_DISTANCE_METERS, COORD_PRECISION
from api.models import SavedRoute, RouteSegment
from shapely.geometry import LineString
from geoalchemy2.shape import from_shape


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    return Mock()


@pytest.fixture
def sample_route():
    """
    Create a sample route for testing.

    This route is approximately 2 miles long with 5 segments.
    """
    route = SavedRoute(
        route_id=1,
        route_name="Test Scenic Route",
        description="A beautiful test drive through the mountains",
        total_curvature=500.0,
        total_length=3218.68,  # 2 miles in meters
        segment_count=5,
        url_slug="test-scenic-route-abc123",
        is_public=True,
        created_at=datetime(2024, 1, 15, 10, 30, 0)
    )

    # Create a simple linestring (Vermont coordinates)
    coords = [
        (-72.5, 44.0),
        (-72.51, 44.01),
        (-72.52, 44.015),
        (-72.53, 44.02),
        (-72.54, 44.025)
    ]
    route.geom = from_shape(LineString(coords), srid=4326)

    # Add segments
    route.segments = []
    for i in range(5):
        seg = RouteSegment(
            id=i+1,
            route_id=1,
            position=i+1,
            start_lat=coords[i][1],
            start_lon=coords[i][0],
            end_lat=coords[i+1][1] if i < 4 else coords[i][1],
            end_lon=coords[i+1][0] if i < 4 else coords[i][0],
            length=643.74,  # ~0.4 miles each
            radius=500.0,
            curvature=100.0,
            curvature_level=2,
            source_way_id=12345 + i,
            way_name=f"Mountain Road {i+1}",
            highway_type="tertiary",
            surface_type="paved"
        )
        route.segments.append(seg)

    return route


class TestExportService:
    """Test the ExportService class."""

    def test_get_route_by_slug(self, mock_db_session, sample_route):
        """Test retrieving a route by URL slug."""
        mock_db_session.query().filter_by().first.return_value = sample_route

        service = ExportService(mock_db_session)
        route = service.get_route("test-scenic-route-abc123")

        assert route is not None
        assert route.route_id == 1
        assert route.route_name == "Test Scenic Route"

    def test_get_route_by_id(self, mock_db_session, sample_route):
        """Test retrieving a route by ID."""
        mock_db_session.query().filter_by().first.side_effect = [None, sample_route]

        service = ExportService(mock_db_session)
        route = service.get_route("1")

        assert route is not None
        assert route.route_id == 1

    def test_get_route_not_found(self, mock_db_session):
        """Test handling of non-existent route."""
        mock_db_session.query().filter_by().first.return_value = None

        service = ExportService(mock_db_session)
        route = service.get_route("nonexistent")

        assert route is None

    def test_densify_route_points(self, mock_db_session, sample_route):
        """Test route densification produces more points."""
        service = ExportService(mock_db_session)

        # Get original point count
        from geoalchemy2.shape import to_shape
        original_linestring = to_shape(sample_route.geom)
        original_count = len(original_linestring.coords)

        # Densify
        densified_coords = service.densify_route_points(sample_route)

        # Should have significantly more points
        assert len(densified_coords) > original_count

        # All coordinates should have proper precision
        for lon, lat in densified_coords:
            assert isinstance(lon, float)
            assert isinstance(lat, float)
            # Check precision (6 decimal places max)
            assert len(str(lon).split('.')[-1]) <= COORD_PRECISION
            assert len(str(lat).split('.')[-1]) <= COORD_PRECISION

    def test_densify_achieves_target_density(self, mock_db_session, sample_route):
        """Test that densification achieves ~30 points per mile."""
        service = ExportService(mock_db_session)

        densified_coords = service.densify_route_points(sample_route)

        # Calculate points per mile
        miles = sample_route.total_length / 1609.34
        points_per_mile = len(densified_coords) / miles

        # Should be close to target (within 50%)
        assert 15 <= points_per_mile <= 45, f"Got {points_per_mile:.1f} points/mile"

    @pytest.mark.asyncio
    async def test_fetch_elevations_success(self, mock_db_session):
        """Test successful elevation API call."""
        service = ExportService(mock_db_session)

        coords = [(-72.5, 44.0), (-72.51, 44.01), (-72.52, 44.02)]

        # Mock httpx response
        mock_response = Mock()
        mock_response.json.return_value = {
            "results": [
                {"latitude": 44.0, "longitude": -72.5, "elevation": 305.5},
                {"latitude": 44.01, "longitude": -72.51, "elevation": 310.2},
                {"latitude": 44.02, "longitude": -72.52, "elevation": 315.8}
            ]
        }
        mock_response.raise_for_status = Mock()

        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

            elevations = await service.fetch_elevations(coords)

        assert len(elevations) == 3
        assert elevations[(-72.5, 44.0)] == 305.5
        assert elevations[(-72.51, 44.01)] == 310.2
        assert elevations[(-72.52, 44.02)] == 315.8

    @pytest.mark.asyncio
    async def test_fetch_elevations_api_failure(self, mock_db_session):
        """Test graceful handling of elevation API failure."""
        service = ExportService(mock_db_session)

        coords = [(-72.5, 44.0), (-72.51, 44.01)]

        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(side_effect=Exception("API Error"))

            elevations = await service.fetch_elevations(coords)

        # Should return empty dict, not crash
        assert elevations == {}

    @pytest.mark.asyncio
    async def test_generate_gpx_track_structure(self, mock_db_session, sample_route):
        """Test GPX track has correct structure and metadata."""
        mock_db_session.query().filter_by().first.return_value = sample_route

        service = ExportService(mock_db_session)

        # Mock elevation API
        with patch.object(service, 'fetch_elevations', AsyncMock(return_value={})):
            gpx_xml = await service.generate_gpx_track("test-scenic-route-abc123")

        assert gpx_xml is not None

        # Parse GPX
        gpx = gpxpy.parse(gpx_xml)

        # Check metadata
        assert gpx.name == "Test Scenic Route"
        assert "beautiful test drive" in gpx.description.lower()
        assert "B-Road GPX Optimizer" in gpx.creator

        # Check track
        assert len(gpx.tracks) == 1
        track = gpx.tracks[0]
        assert track.name == "Test Scenic Route"

        # Check segments
        assert len(track.segments) == 1
        segment = track.segments[0]

        # Should have many points (densified)
        assert len(segment.points) > 5

    @pytest.mark.asyncio
    async def test_generate_gpx_with_elevations(self, mock_db_session, sample_route):
        """Test GPX track includes elevation data."""
        mock_db_session.query().filter_by().first.return_value = sample_route

        service = ExportService(mock_db_session)

        # Mock elevation API with data
        mock_elevations = {
            (-72.5, 44.0): 305.5,
            (-72.51, 44.01): 310.2
        }

        with patch.object(service, 'fetch_elevations', AsyncMock(return_value=mock_elevations)):
            gpx_xml = await service.generate_gpx_track("test-scenic-route-abc123")

        # Parse GPX
        gpx = gpxpy.parse(gpx_xml)
        segment = gpx.tracks[0].segments[0]

        # Check that some points have elevation
        points_with_elevation = [p for p in segment.points if p.elevation is not None]
        assert len(points_with_elevation) > 0

    @pytest.mark.asyncio
    async def test_generate_gpx_coordinate_precision(self, mock_db_session, sample_route):
        """Test GPX coordinates have correct precision."""
        mock_db_session.query().filter_by().first.return_value = sample_route

        service = ExportService(mock_db_session)

        with patch.object(service, 'fetch_elevations', AsyncMock(return_value={})):
            gpx_xml = await service.generate_gpx_track("test-scenic-route-abc123")

        # Parse and check precision
        gpx = gpxpy.parse(gpx_xml)
        segment = gpx.tracks[0].segments[0]

        for point in segment.points:
            # Check that coordinates don't have excessive precision
            lat_str = str(point.latitude)
            lon_str = str(point.longitude)

            if '.' in lat_str:
                lat_decimals = len(lat_str.split('.')[-1])
                assert lat_decimals <= COORD_PRECISION

            if '.' in lon_str:
                lon_decimals = len(lon_str.split('.')[-1])
                assert lon_decimals <= COORD_PRECISION

    def test_generate_kml_structure(self, mock_db_session, sample_route):
        """Test KML generation produces valid XML."""
        mock_db_session.query().filter_by().first.return_value = sample_route

        service = ExportService(mock_db_session)
        kml_xml = service.generate_kml("test-scenic-route-abc123")

        assert kml_xml is not None

        # Parse XML
        root = ET.fromstring(kml_xml)

        # Check namespaces
        assert 'kml' in root.tag.lower()

        # Check document
        doc = root.find('.//{http://www.opengis.net/kml/2.2}Document')
        assert doc is not None

        # Check name
        name = doc.find('.//{http://www.opengis.net/kml/2.2}name')
        assert name is not None
        assert name.text == "Test Scenic Route"

        # Check placemark
        placemark = doc.find('.//{http://www.opengis.net/kml/2.2}Placemark')
        assert placemark is not None

        # Check coordinates
        coords = doc.find('.//{http://www.opengis.net/kml/2.2}coordinates')
        assert coords is not None
        assert len(coords.text.strip()) > 0

    def test_generate_kml_styling(self, mock_db_session, sample_route):
        """Test KML includes proper styling based on curvature."""
        mock_db_session.query().filter_by().first.return_value = sample_route

        service = ExportService(mock_db_session)
        kml_xml = service.generate_kml("test-scenic-route-abc123")

        # Parse XML
        root = ET.fromstring(kml_xml)

        # Check style definition
        style = root.find('.//{http://www.opengis.net/kml/2.2}Style')
        assert style is not None

        # Check line style
        line_style = style.find('.//{http://www.opengis.net/kml/2.2}LineStyle')
        assert line_style is not None

        color = line_style.find('.//{http://www.opengis.net/kml/2.2}color')
        width = line_style.find('.//{http://www.opengis.net/kml/2.2}width')

        assert color is not None
        assert width is not None
        assert int(width.text) >= 4

    def test_generate_kml_metadata(self, mock_db_session, sample_route):
        """Test KML includes route statistics in description."""
        mock_db_session.query().filter_by().first.return_value = sample_route

        service = ExportService(mock_db_session)
        kml_xml = service.generate_kml("test-scenic-route-abc123")

        # Check that statistics are in the XML
        assert "500" in kml_xml  # curvature
        assert "2.00" in kml_xml or "2.0" in kml_xml  # miles
        assert "Segments" in kml_xml
        assert "5" in kml_xml  # segment count

    @pytest.mark.asyncio
    async def test_generate_gpx_route_not_found(self, mock_db_session):
        """Test GPX generation for non-existent route."""
        mock_db_session.query().filter_by().first.return_value = None

        service = ExportService(mock_db_session)
        gpx_xml = await service.generate_gpx_track("nonexistent")

        assert gpx_xml is None

    def test_generate_kml_route_not_found(self, mock_db_session):
        """Test KML generation for non-existent route."""
        mock_db_session.query().filter_by().first.return_value = None

        service = ExportService(mock_db_session)
        kml_xml = service.generate_kml("nonexistent")

        assert kml_xml is None


class TestConvenienceFunctions:
    """Test the convenience functions for FastAPI endpoints."""

    @pytest.mark.asyncio
    async def test_generate_gpx_for_route(self, mock_db_session, sample_route):
        """Test generate_gpx_for_route convenience function."""
        from api.export_service import generate_gpx_for_route

        mock_db_session.query().filter_by().first.return_value = sample_route

        with patch('api.export_service.ExportService.fetch_elevations', AsyncMock(return_value={})):
            gpx_xml = await generate_gpx_for_route(mock_db_session, "test-scenic-route-abc123")

        assert gpx_xml is not None
        assert "Test Scenic Route" in gpx_xml

    def test_generate_kml_for_route(self, mock_db_session, sample_route):
        """Test generate_kml_for_route convenience function."""
        from api.export_service import generate_kml_for_route

        mock_db_session.query().filter_by().first.return_value = sample_route

        kml_xml = generate_kml_for_route(mock_db_session, "test-scenic-route-abc123")

        assert kml_xml is not None
        assert "Test Scenic Route" in kml_xml


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
