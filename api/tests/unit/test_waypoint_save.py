"""
Unit tests for waypoint route saving, retrieval, and export.

Tests the extended schemas, route service, and export service for
waypoint-based routes.
"""

import pytest
from pydantic import ValidationError

from api.models.schemas import (
    SaveRouteRequest,
    WaypointData,
    WaypointResponse,
    RouteResponse,
    RouteDetailResponse,
)

# ---------------------------------------------------------------------------
# Schema validation tests
# ---------------------------------------------------------------------------


class TestWaypointData:
    """Tests for WaypointData model."""

    def test_valid_waypoint(self):
        wp = WaypointData(lng=-80.84, lat=35.22, order=0)
        assert wp.lng == -80.84
        assert wp.lat == 35.22
        assert wp.order == 0
        assert wp.segment_id is None
        assert wp.is_user_modified is False

    def test_waypoint_with_all_fields(self):
        wp = WaypointData(
            lng=-80.84, lat=35.22, order=1, segment_id="seg_001", is_user_modified=True
        )
        assert wp.segment_id == "seg_001"
        assert wp.is_user_modified is True

    def test_rejects_invalid_lng(self):
        with pytest.raises(ValidationError):
            WaypointData(lng=-200, lat=35.22, order=0)

    def test_rejects_invalid_lat(self):
        with pytest.raises(ValidationError):
            WaypointData(lng=-80.84, lat=100, order=0)

    def test_rejects_negative_order(self):
        with pytest.raises(ValidationError):
            WaypointData(lng=-80.84, lat=35.22, order=-1)


class TestSaveRouteRequestWaypoint:
    """Tests for SaveRouteRequest with waypoint route_type."""

    def test_valid_waypoint_route(self):
        req = SaveRouteRequest(
            route_name="NC Mountain Loop",
            route_type="waypoint",
            waypoints=[
                WaypointData(lng=-80.84, lat=35.22, order=0),
                WaypointData(lng=-80.79, lat=35.24, order=1),
            ],
            connecting_geometry={
                "type": "LineString",
                "coordinates": [[-80.84, 35.22], [-80.82, 35.23], [-80.79, 35.24]],
            },
        )
        assert req.route_type == "waypoint"
        assert len(req.waypoints) == 2
        assert req.segments is None

    def test_rejects_waypoint_route_without_waypoints(self):
        with pytest.raises(ValidationError, match="at least 2 waypoints"):
            SaveRouteRequest(
                route_name="Bad Route",
                route_type="waypoint",
                connecting_geometry={"type": "LineString", "coordinates": []},
            )

    def test_rejects_waypoint_route_with_single_waypoint(self):
        with pytest.raises(ValidationError, match="at least 2 waypoints"):
            SaveRouteRequest(
                route_name="Bad Route",
                route_type="waypoint",
                waypoints=[WaypointData(lng=-80.84, lat=35.22, order=0)],
                connecting_geometry={"type": "LineString", "coordinates": []},
            )

    def test_rejects_waypoint_route_without_geometry(self):
        with pytest.raises(ValidationError, match="connecting_geometry required"):
            SaveRouteRequest(
                route_name="Bad Route",
                route_type="waypoint",
                waypoints=[
                    WaypointData(lng=-80.84, lat=35.22, order=0),
                    WaypointData(lng=-80.79, lat=35.24, order=1),
                ],
            )

    def test_segment_list_still_requires_segments(self):
        with pytest.raises(ValidationError, match="segments required"):
            SaveRouteRequest(
                route_name="Bad Route",
                route_type="segment_list",
            )

    def test_rejects_invalid_route_type(self):
        with pytest.raises(ValidationError):
            SaveRouteRequest(
                route_name="Bad Route",
                route_type="invalid",
            )

    def test_waypoint_route_with_description_and_public(self):
        req = SaveRouteRequest(
            route_name="Blue Ridge Parkway",
            description="Scenic mountain drive",
            route_type="waypoint",
            is_public=True,
            waypoints=[
                WaypointData(lng=-80.84, lat=35.22, order=0),
                WaypointData(lng=-80.79, lat=35.24, order=1),
            ],
            connecting_geometry={
                "type": "LineString",
                "coordinates": [[-80.84, 35.22], [-80.79, 35.24]],
            },
        )
        assert req.description == "Scenic mountain drive"
        assert req.is_public is True


class TestRouteResponseRouteType:
    """Tests for route_type field in response models."""

    def test_route_response_default_type(self):
        resp = RouteResponse(
            route_id=1,
            route_name="Test",
            description=None,
            total_curvature=100,
            total_length_km=10,
            total_length_mi=6.2,
            segment_count=5,
            url_slug="test-abc",
            created_at="2024-01-01T00:00:00",
            is_public=False,
        )
        assert resp.route_type == "segment_list"

    def test_route_response_waypoint_type(self):
        resp = RouteResponse(
            route_id=1,
            route_name="Test",
            description=None,
            total_curvature=0,
            total_length_km=10,
            total_length_mi=6.2,
            segment_count=3,
            url_slug="test-abc",
            created_at="2024-01-01T00:00:00",
            is_public=False,
            route_type="waypoint",
        )
        assert resp.route_type == "waypoint"

    def test_detail_response_with_waypoints(self):
        resp = RouteDetailResponse(
            route_id=1,
            route_name="Test",
            description=None,
            total_curvature=0,
            total_length_km=10,
            total_length_mi=6.2,
            segment_count=2,
            url_slug="test-abc",
            created_at="2024-01-01T00:00:00",
            is_public=False,
            route_type="waypoint",
            geojson={
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": []},
            },
            segments=[],
            waypoints=[
                WaypointResponse(lng=-80.84, lat=35.22, order=0),
                WaypointResponse(lng=-80.79, lat=35.24, order=1),
            ],
            connecting_geometry={
                "type": "LineString",
                "coordinates": [[-80.84, 35.22], [-80.79, 35.24]],
            },
        )
        assert len(resp.waypoints) == 2
        assert resp.connecting_geometry is not None

    def test_detail_response_segment_list_no_waypoints(self):
        resp = RouteDetailResponse(
            route_id=1,
            route_name="Test",
            description=None,
            total_curvature=100,
            total_length_km=10,
            total_length_mi=6.2,
            segment_count=5,
            url_slug="test-abc",
            created_at="2024-01-01T00:00:00",
            is_public=False,
            route_type="segment_list",
            geojson={
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": []},
            },
            segments=[{"way_id": 1}],
        )
        assert resp.waypoints is None
        assert resp.connecting_geometry is None


class TestWaypointResponse:
    """Tests for WaypointResponse model."""

    def test_basic_waypoint_response(self):
        wp = WaypointResponse(lng=-80.84, lat=35.22, order=0)
        assert wp.segment_id is None
        assert wp.is_user_modified is False

    def test_full_waypoint_response(self):
        wp = WaypointResponse(
            lng=-80.84, lat=35.22, order=1, segment_id="seg_001", is_user_modified=True
        )
        assert wp.segment_id == "seg_001"
        assert wp.is_user_modified is True
