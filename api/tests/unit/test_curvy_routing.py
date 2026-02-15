"""
Unit tests for the curvy route finding service and models.

Tests scoring logic, segment selection, detour trimming, and edge cases
with mocked OSRM and repository responses.
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock

from api.models.routing import WaypointRequest, RouteGeometry, CalculateRouteResponse, SnappedWaypoint
from api.models.curvy_routing import (
    CurvyRouteOptions,
    CurvyRouteRequest,
    CurvyRouteResponse,
    CurvySegmentInfo,
)
from api.services.curvy_route_service import CurvyRouteService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_db():
    """Mock database session."""
    return MagicMock()


@pytest.fixture
def mock_osrm():
    """Mock OSRM service."""
    return AsyncMock()


@pytest.fixture
def service(mock_db, mock_osrm):
    """CurvyRouteService with mocked dependencies."""
    return CurvyRouteService(db=mock_db, osrm_service=mock_osrm)


@pytest.fixture
def baseline_route():
    """A mock baseline OSRM route response."""
    return CalculateRouteResponse(
        geometry=RouteGeometry(
            type="LineString",
            coordinates=[[-72.5, 44.2], [-72.6, 44.1], [-72.8, 43.9]],
        ),
        distance=50000.0,
        duration=3600.0,
        waypoints=[
            SnappedWaypoint(lng=-72.5, lat=44.2),
            SnappedWaypoint(lng=-72.8, lat=43.9),
        ],
    )


@pytest.fixture
def sample_corridor_segments():
    """Sample segments as returned by get_segments_in_corridor."""
    return [
        {
            "id": 1,
            "name": "Mountain Road",
            "curvature": 2500,
            "length": 15000,
            "geometry": '{"type":"LineString","coordinates":[[-72.58,44.26],[-72.60,44.27]]}',
            "distance_from_route": 2000,
            "route_position": 0.2,
            "centroid_lng": -72.59,
            "centroid_lat": 44.265,
        },
        {
            "id": 3,
            "name": "Lincoln Gap Road",
            "curvature": 3200,
            "length": 18000,
            "geometry": '{"type":"LineString","coordinates":[[-72.90,44.05],[-72.92,44.07]]}',
            "distance_from_route": 5000,
            "route_position": 0.6,
            "centroid_lng": -72.91,
            "centroid_lat": 44.06,
        },
        {
            "id": 4,
            "name": "Smugglers Notch Road",
            "curvature": 4500,
            "length": 20000,
            "geometry": '{"type":"LineString","coordinates":[[-72.775,44.535],[-72.795,44.555]]}',
            "distance_from_route": 12000,
            "route_position": 0.1,
            "centroid_lng": -72.785,
            "centroid_lat": 44.545,
        },
    ]


@pytest.fixture
def curvy_request():
    """Standard curvy route request."""
    return CurvyRouteRequest(
        start=WaypointRequest(lng=-72.5, lat=44.2),
        end=WaypointRequest(lng=-72.8, lat=43.9),
    )


# ---------------------------------------------------------------------------
# Model validation tests
# ---------------------------------------------------------------------------


class TestCurvyRouteModels:
    """Tests for curvy routing Pydantic models."""

    def test_default_options(self):
        opts = CurvyRouteOptions()
        assert opts.corridor_width == 15000
        assert opts.min_curvature == 500
        assert opts.max_waypoints == 20
        assert opts.max_detour_ratio == 2.5

    def test_options_validation_corridor_width(self):
        with pytest.raises(Exception):
            CurvyRouteOptions(corridor_width=500)  # below min 1000
        with pytest.raises(Exception):
            CurvyRouteOptions(corridor_width=100000)  # above max 50000

    def test_options_validation_detour_ratio(self):
        with pytest.raises(Exception):
            CurvyRouteOptions(max_detour_ratio=0.5)  # below min 1.1
        with pytest.raises(Exception):
            CurvyRouteOptions(max_detour_ratio=10.0)  # above max 5.0

    def test_request_with_defaults(self):
        req = CurvyRouteRequest(
            start=WaypointRequest(lng=-72.5, lat=44.2),
            end=WaypointRequest(lng=-72.8, lat=43.9),
        )
        assert req.options.corridor_width == 15000

    def test_request_with_custom_options(self):
        req = CurvyRouteRequest(
            start=WaypointRequest(lng=-72.5, lat=44.2),
            end=WaypointRequest(lng=-72.8, lat=43.9),
            options=CurvyRouteOptions(corridor_width=25000, min_curvature=1000),
        )
        assert req.options.corridor_width == 25000
        assert req.options.min_curvature == 1000

    def test_segment_info(self):
        info = CurvySegmentInfo(
            id=1, name="Test", curvature=2500, length=15000, score=0.85
        )
        assert info.score == 0.85

    def test_segment_info_optional_name(self):
        info = CurvySegmentInfo(id=1, curvature=2500, length=15000, score=0.5)
        assert info.name is None


# ---------------------------------------------------------------------------
# Scoring tests
# ---------------------------------------------------------------------------


class TestSegmentScoring:
    """Tests for the segment scoring algorithm."""

    def test_scores_segments(self, service, sample_corridor_segments):
        scored = service._score_segments(sample_corridor_segments, corridor_width=15000)
        assert len(scored) == 3
        assert all("score" in s for s in scored)
        # All scores between 0 and 1
        assert all(0 <= s["score"] <= 1 for s in scored)

    def test_higher_curvature_scores_higher(self, service):
        segments = [
            {"id": 1, "curvature": 1000, "length": 10000, "distance_from_route": 5000, "route_position": 0.3},
            {"id": 2, "curvature": 3000, "length": 10000, "distance_from_route": 5000, "route_position": 0.6},
        ]
        scored = service._score_segments(segments, corridor_width=15000)
        # Segment with curvature 3000 should score higher
        by_id = {s["id"]: s["score"] for s in scored}
        assert by_id[2] > by_id[1]

    def test_longer_segments_score_higher(self, service):
        segments = [
            {"id": 1, "curvature": 2000, "length": 5000, "distance_from_route": 5000, "route_position": 0.3},
            {"id": 2, "curvature": 2000, "length": 20000, "distance_from_route": 5000, "route_position": 0.6},
        ]
        scored = service._score_segments(segments, corridor_width=15000)
        by_id = {s["id"]: s["score"] for s in scored}
        assert by_id[2] > by_id[1]

    def test_closer_to_route_scores_higher(self, service):
        segments = [
            {"id": 1, "curvature": 2000, "length": 10000, "distance_from_route": 1000, "route_position": 0.3},
            {"id": 2, "curvature": 2000, "length": 10000, "distance_from_route": 14000, "route_position": 0.6},
        ]
        scored = service._score_segments(segments, corridor_width=15000)
        by_id = {s["id"]: s["score"] for s in scored}
        assert by_id[1] > by_id[2]

    def test_empty_segments_returns_empty(self, service):
        assert service._score_segments([], corridor_width=15000) == []

    def test_sorted_by_score_descending(self, service, sample_corridor_segments):
        scored = service._score_segments(sample_corridor_segments, corridor_width=15000)
        scores = [s["score"] for s in scored]
        assert scores == sorted(scores, reverse=True)


# ---------------------------------------------------------------------------
# Selection tests
# ---------------------------------------------------------------------------


class TestSegmentSelection:
    """Tests for segment selection with spacing constraints."""

    def test_respects_max_waypoints(self, service):
        segments = [
            {"id": i, "score": 1.0 - (i * 0.01), "route_position": i * 0.1}
            for i in range(15)
        ]
        selected = service._select_segments(segments, max_waypoints=5)
        assert len(selected) == 5

    def test_skips_segments_too_close(self, service):
        segments = [
            {"id": 1, "score": 0.9, "route_position": 0.50},
            {"id": 2, "score": 0.8, "route_position": 0.51},  # too close to id=1
            {"id": 3, "score": 0.7, "route_position": 0.80},
        ]
        selected = service._select_segments(segments, max_waypoints=20)
        ids = [s["id"] for s in selected]
        assert 1 in ids
        assert 2 not in ids  # filtered out — within 0.03 of id=1
        assert 3 in ids

    def test_empty_input_returns_empty(self, service):
        assert service._select_segments([], max_waypoints=20) == []


# ---------------------------------------------------------------------------
# Waypoint building tests
# ---------------------------------------------------------------------------


class TestWaypointBuilding:
    """Tests for waypoint list construction."""

    def test_builds_start_segments_end(self, service, curvy_request):
        selected = [
            {"centroid_lng": -72.59, "centroid_lat": 44.265, "route_position": 0.2},
            {"centroid_lng": -72.91, "centroid_lat": 44.06, "route_position": 0.6},
        ]
        waypoints = service._build_waypoint_list(curvy_request, selected)
        assert len(waypoints) == 4  # start + 2 segments + end
        assert waypoints[0].lng == -72.5  # start
        assert waypoints[-1].lng == -72.8  # end
        assert waypoints[1].lng == -72.59  # first segment centroid

    def test_empty_segments_gives_start_end_only(self, service, curvy_request):
        waypoints = service._build_waypoint_list(curvy_request, [])
        assert len(waypoints) == 2


# ---------------------------------------------------------------------------
# Full route finding tests (with mocked OSRM + repo)
# ---------------------------------------------------------------------------


class TestFindCurvyRoute:
    """Integration-style tests for the full find_curvy_route method."""

    @pytest.mark.asyncio
    async def test_returns_baseline_when_no_segments(
        self, service, mock_osrm, curvy_request, baseline_route
    ):
        """When no curvy segments found, return the baseline route."""
        mock_osrm.calculate_route = AsyncMock(return_value=baseline_route)

        with patch.object(service.repo, "get_segments_in_corridor", return_value=[]):
            result = await service.find_curvy_route(curvy_request)

        assert isinstance(result, CurvyRouteResponse)
        assert result.curvy_segments == []
        assert result.waypoints_used == 0
        assert result.distance == baseline_route.distance
        assert result.detour_ratio == 1.0

    @pytest.mark.asyncio
    async def test_injects_curvy_waypoints(
        self, service, mock_osrm, curvy_request, baseline_route, sample_corridor_segments
    ):
        """When curvy segments found, they are injected as waypoints."""
        curvy_route = CalculateRouteResponse(
            geometry=RouteGeometry(
                type="LineString",
                coordinates=[[-72.5, 44.2], [-72.59, 44.265], [-72.91, 44.06], [-72.8, 43.9]],
            ),
            distance=65000.0,
            duration=4800.0,
            waypoints=[
                SnappedWaypoint(lng=-72.5, lat=44.2),
                SnappedWaypoint(lng=-72.59, lat=44.265),
                SnappedWaypoint(lng=-72.91, lat=44.06),
                SnappedWaypoint(lng=-72.8, lat=43.9),
            ],
        )
        # First call: baseline. Subsequent calls: curvy route.
        mock_osrm.calculate_route = AsyncMock(side_effect=[baseline_route, curvy_route])

        with patch.object(
            service.repo, "get_segments_in_corridor", return_value=sample_corridor_segments
        ):
            result = await service.find_curvy_route(curvy_request)

        assert result.waypoints_used == 3
        assert len(result.curvy_segments) == 3
        assert result.distance == 65000.0
        assert result.baseline_distance == 50000.0
        assert result.detour_ratio == 1.3

    @pytest.mark.asyncio
    async def test_trims_when_detour_too_large(
        self, service, mock_osrm, curvy_request, baseline_route, sample_corridor_segments
    ):
        """When detour ratio exceeds max, lowest-scored segments are trimmed."""
        # First route attempt is too long (3x baseline)
        long_route = CalculateRouteResponse(
            geometry=RouteGeometry(
                type="LineString",
                coordinates=[[-72.5, 44.2], [-72.8, 43.9]],
            ),
            distance=150000.0,  # 3x baseline
            duration=10000.0,
            waypoints=[
                SnappedWaypoint(lng=-72.5, lat=44.2),
                SnappedWaypoint(lng=-72.8, lat=43.9),
            ],
        )
        # After trimming, route is acceptable
        trimmed_route = CalculateRouteResponse(
            geometry=RouteGeometry(
                type="LineString",
                coordinates=[[-72.5, 44.2], [-72.8, 43.9]],
            ),
            distance=100000.0,  # 2x baseline — within 2.5x limit
            duration=7000.0,
            waypoints=[
                SnappedWaypoint(lng=-72.5, lat=44.2),
                SnappedWaypoint(lng=-72.8, lat=43.9),
            ],
        )
        mock_osrm.calculate_route = AsyncMock(
            side_effect=[baseline_route, long_route, trimmed_route]
        )

        with patch.object(
            service.repo, "get_segments_in_corridor", return_value=sample_corridor_segments
        ):
            result = await service.find_curvy_route(curvy_request)

        assert result.detour_ratio <= 2.5
        assert result.waypoints_used < 3  # at least one was trimmed

    @pytest.mark.asyncio
    async def test_short_route_reduces_corridor(
        self, service, mock_osrm, baseline_route
    ):
        """Routes under 5km get reduced corridor width and max waypoints."""
        short_baseline = CalculateRouteResponse(
            geometry=RouteGeometry(
                type="LineString",
                coordinates=[[-72.5, 44.2], [-72.51, 44.21]],
            ),
            distance=3000.0,  # 3km
            duration=200.0,
            waypoints=[
                SnappedWaypoint(lng=-72.5, lat=44.2),
                SnappedWaypoint(lng=-72.51, lat=44.21),
            ],
        )
        mock_osrm.calculate_route = AsyncMock(return_value=short_baseline)

        request = CurvyRouteRequest(
            start=WaypointRequest(lng=-72.5, lat=44.2),
            end=WaypointRequest(lng=-72.51, lat=44.21),
        )

        with patch.object(service.repo, "get_segments_in_corridor", return_value=[]) as mock_repo:
            result = await service.find_curvy_route(request)

        # Verify corridor was reduced
        call_args = mock_repo.call_args
        assert call_args.kwargs["buffer_meters"] == 5000

    @pytest.mark.asyncio
    async def test_generated_waypoints_in_response(
        self, service, mock_osrm, curvy_request, baseline_route, sample_corridor_segments
    ):
        """Response includes generated_waypoints for 'convert to waypoints' feature."""
        curvy_route = CalculateRouteResponse(
            geometry=RouteGeometry(
                type="LineString",
                coordinates=[[-72.5, 44.2], [-72.8, 43.9]],
            ),
            distance=60000.0,
            duration=4000.0,
            waypoints=[SnappedWaypoint(lng=-72.5, lat=44.2), SnappedWaypoint(lng=-72.8, lat=43.9)],
        )
        mock_osrm.calculate_route = AsyncMock(side_effect=[baseline_route, curvy_route])

        with patch.object(
            service.repo, "get_segments_in_corridor", return_value=sample_corridor_segments
        ):
            result = await service.find_curvy_route(curvy_request)

        # Should include start + segment centroids + end
        assert len(result.generated_waypoints) == 5  # start + 3 segments + end
        assert result.generated_waypoints[0].lng == -72.5  # start
        assert result.generated_waypoints[-1].lng == -72.8  # end
