"""
Unit tests for route export endpoints (GPX/KML).

Tests export functionality with mocked database to avoid
requiring a running database instance.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from api.server import app


@pytest.fixture
def client():
    """FastAPI test client."""
    with TestClient(app) as c:
        yield c


def _make_mock_segment_route():
    """Create a mock segment-list route for export tests."""
    seg1 = MagicMock()
    seg1.position = 1
    seg1.start_lat = 35.22
    seg1.start_lon = -80.84
    seg1.end_lat = 35.23
    seg1.end_lon = -80.82

    seg2 = MagicMock()
    seg2.position = 2
    seg2.start_lat = 35.23
    seg2.start_lon = -80.82
    seg2.end_lat = 35.24
    seg2.end_lon = -80.79

    route = MagicMock()
    route.route_name = "NC Mountain Road"
    route.description = "A twisty mountain road"
    route.url_slug = "nc-mountain-road-abc12345"
    route.total_curvature = 1500.0
    route.total_length = 5000.0
    route.segment_count = 2
    route.route_type = "segment_list"
    route.route_data = {"segments": []}
    route.segments = [seg1, seg2]
    route.waypoints = []
    route.is_public = True
    return route


def _make_mock_waypoint_route():
    """Create a mock waypoint route for export tests."""
    wp1 = MagicMock()
    wp1.lng = -80.84
    wp1.lat = 35.22
    wp1.waypoint_order = 0
    wp1.segment_id = "seg_001"
    wp1.is_user_modified = False

    wp2 = MagicMock()
    wp2.lng = -80.79
    wp2.lat = 35.24
    wp2.waypoint_order = 1
    wp2.segment_id = "seg_002"
    wp2.is_user_modified = False

    route = MagicMock()
    route.route_name = "NC Waypoint Route"
    route.description = "A waypoint-routed drive"
    route.url_slug = "nc-waypoint-abc12345"
    route.total_curvature = 0
    route.total_length = 0
    route.segment_count = 2
    route.route_type = "waypoint"
    route.route_data = {
        "waypoints": [],
        "connecting_geometry": {
            "type": "LineString",
            "coordinates": [
                [-80.84, 35.22],
                [-80.82, 35.23],
                [-80.80, 35.235],
                [-80.79, 35.24],
            ],
        },
    }
    route.segments = []
    route.waypoints = [wp1, wp2]
    route.is_public = True
    return route


class TestGPXExportEndpoint:
    """Tests for GET /routes/shared/{slug}/export/gpx."""

    def test_exports_segment_route_gpx(self, client):
        """GPX export works for segment-list routes."""
        mock_route = _make_mock_segment_route()

        with patch("api.services.export_service.RouteRepository") as MockRepo:
            MockRepo.return_value.get_by_id_or_slug.return_value = mock_route
            response = client.get("/routes/shared/nc-mountain-road-abc12345/export/gpx")

        assert response.status_code == 200
        assert "application/gpx+xml" in response.headers["content-type"]
        assert (
            "nc-mountain-road-abc12345.gpx" in response.headers["content-disposition"]
        )
        content = response.text
        assert "<trk>" in content
        assert "NC Mountain Road" in content
        assert "<trkpt" in content

    def test_exports_waypoint_route_gpx(self, client):
        """GPX export uses connecting geometry for waypoint routes."""
        mock_route = _make_mock_waypoint_route()

        with patch("api.services.export_service.RouteRepository") as MockRepo:
            MockRepo.return_value.get_by_id_or_slug.return_value = mock_route
            response = client.get("/routes/shared/nc-waypoint-abc12345/export/gpx")

        assert response.status_code == 200
        content = response.text
        assert "NC Waypoint Route" in content
        # Should have 4 track points from the connecting geometry
        assert content.count("<trkpt") == 4

    def test_returns_404_for_missing_route(self, client):
        """GPX export returns 404 for non-existent route."""
        with patch("api.services.export_service.RouteRepository") as MockRepo:
            MockRepo.return_value.get_by_id_or_slug.return_value = None
            response = client.get("/routes/shared/nonexistent/export/gpx")

        assert response.status_code == 404


class TestKMLExportEndpoint:
    """Tests for GET /routes/shared/{slug}/export/kml."""

    def test_exports_segment_route_kml(self, client):
        """KML export works for segment-list routes."""
        mock_route = _make_mock_segment_route()

        with patch("api.services.export_service.RouteRepository") as MockRepo:
            MockRepo.return_value.get_by_id_or_slug.return_value = mock_route
            response = client.get("/routes/shared/nc-mountain-road-abc12345/export/kml")

        assert response.status_code == 200
        assert (
            "application/vnd.google-earth.kml+xml" in response.headers["content-type"]
        )
        content = response.text
        assert "<kml" in content
        assert "NC Mountain Road" in content
        assert "<coordinates>" in content

    def test_exports_waypoint_route_kml(self, client):
        """KML export uses connecting geometry for waypoint routes."""
        mock_route = _make_mock_waypoint_route()

        with patch("api.services.export_service.RouteRepository") as MockRepo:
            MockRepo.return_value.get_by_id_or_slug.return_value = mock_route
            response = client.get("/routes/shared/nc-waypoint-abc12345/export/kml")

        assert response.status_code == 200
        content = response.text
        assert "NC Waypoint Route" in content
        # Should contain all 4 coordinate points from connecting geometry
        assert "-80.84,35.22,0" in content
        assert "-80.79,35.24,0" in content

    def test_returns_404_for_missing_route(self, client):
        """KML export returns 404 for non-existent route."""
        with patch("api.services.export_service.RouteRepository") as MockRepo:
            MockRepo.return_value.get_by_id_or_slug.return_value = None
            response = client.get("/routes/shared/nonexistent/export/kml")

        assert response.status_code == 404
