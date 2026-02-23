"""
Unit tests for OSRM routing service and endpoints.

Tests routing functionality with mocked OSRM responses to avoid
requiring a running OSRM instance.
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import httpx
from fastapi.testclient import TestClient

from api.server import app
from api.services.osrm_service import OSRMService, OSRMError
from api.models.routing import (
    WaypointRequest,
    CalculateRouteRequest,
    CalculateRouteResponse,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client():
    """FastAPI test client (no DB needed for routing)."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def osrm_service():
    """OSRMService instance pointing to a test URL."""
    return OSRMService(base_url="http://test-osrm:5000", timeout=5)


@pytest.fixture
def mock_osrm_response():
    """Mock successful OSRM route response."""
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {
        "code": "Ok",
        "routes": [
            {
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-80.8431, 35.2271],
                        [-80.82, 35.23],
                        [-80.7933, 35.2387],
                    ],
                },
                "distance": 5432.1,
                "duration": 423.7,
            }
        ],
        "waypoints": [
            {"location": [-80.8431, 35.2271]},
            {"location": [-80.7933, 35.2387]},
        ],
    }
    return response


@pytest.fixture
def two_waypoints():
    """Two valid waypoints for route calculation."""
    return [
        WaypointRequest(lng=-80.8431, lat=35.2271),
        WaypointRequest(lng=-80.7933, lat=35.2387),
    ]


@pytest.fixture
def three_waypoints():
    """Three valid waypoints for route calculation."""
    return [
        WaypointRequest(lng=-80.8431, lat=35.2271),
        WaypointRequest(lng=-80.82, lat=35.23),
        WaypointRequest(lng=-80.7933, lat=35.2387),
    ]


# ---------------------------------------------------------------------------
# OSRMService unit tests
# ---------------------------------------------------------------------------


class TestOSRMServiceCalculate:
    """Tests for OSRMService.calculate_route()."""

    @pytest.mark.asyncio
    async def test_returns_route_for_valid_waypoints(
        self, osrm_service, two_waypoints, mock_osrm_response
    ):
        """Valid waypoints return a route with geometry, distance, and duration."""
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_osrm_response)

        with patch(
            "api.services.osrm_service.httpx.AsyncClient", return_value=mock_client
        ):
            result = await osrm_service.calculate_route(two_waypoints)

        assert isinstance(result, CalculateRouteResponse)
        assert result.geometry.type == "LineString"
        assert len(result.geometry.coordinates) == 3
        assert result.distance == 5432.1
        assert result.duration == 423.7
        assert len(result.waypoints) == 2
        assert result.waypoints[0].lng == -80.8431
        assert result.waypoints[0].snapped is True

    @pytest.mark.asyncio
    async def test_builds_correct_osrm_url(
        self, osrm_service, two_waypoints, mock_osrm_response
    ):
        """OSRM URL is built with semicolon-separated lng,lat pairs."""
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_osrm_response)

        with patch(
            "api.services.osrm_service.httpx.AsyncClient", return_value=mock_client
        ):
            await osrm_service.calculate_route(two_waypoints)

        call_args = mock_client.get.call_args
        url = call_args[0][0]
        assert "-80.8431,35.2271;-80.7933,35.2387" in url
        assert url.startswith("http://test-osrm:5000/route/v1/driving/")

    @pytest.mark.asyncio
    async def test_requests_geojson_geometry(
        self, osrm_service, two_waypoints, mock_osrm_response
    ):
        """OSRM request includes geojson geometry format and full overview."""
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_osrm_response)

        with patch(
            "api.services.osrm_service.httpx.AsyncClient", return_value=mock_client
        ):
            await osrm_service.calculate_route(two_waypoints)

        params = mock_client.get.call_args[1]["params"]
        assert params["geometries"] == "geojson"
        assert params["overview"] == "full"

    @pytest.mark.asyncio
    async def test_raises_on_connection_error(self, osrm_service, two_waypoints):
        """Connection error raises OSRMError with 503."""
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(
            side_effect=httpx.ConnectError("Connection refused")
        )

        with patch(
            "api.services.osrm_service.httpx.AsyncClient", return_value=mock_client
        ):
            with pytest.raises(OSRMError, match="unavailable"):
                await osrm_service.calculate_route(two_waypoints)

    @pytest.mark.asyncio
    async def test_raises_on_timeout(self, osrm_service, two_waypoints):
        """Timeout raises OSRMError."""
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("Timed out"))

        with patch(
            "api.services.osrm_service.httpx.AsyncClient", return_value=mock_client
        ):
            with pytest.raises(OSRMError, match="timed out"):
                await osrm_service.calculate_route(two_waypoints)

    @pytest.mark.asyncio
    async def test_raises_on_osrm_error_code(self, osrm_service, two_waypoints):
        """Non-Ok OSRM code raises OSRMError with 422."""
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "code": "NoRoute",
            "message": "No route found between given coordinates",
        }

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=response)

        with patch(
            "api.services.osrm_service.httpx.AsyncClient", return_value=mock_client
        ):
            with pytest.raises(OSRMError, match="No route found"):
                await osrm_service.calculate_route(two_waypoints)

    @pytest.mark.asyncio
    async def test_raises_on_http_error(self, osrm_service, two_waypoints):
        """Non-200 HTTP status raises OSRMError with 502."""
        response = MagicMock()
        response.status_code = 500

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=response)

        with patch(
            "api.services.osrm_service.httpx.AsyncClient", return_value=mock_client
        ):
            with pytest.raises(OSRMError) as exc_info:
                await osrm_service.calculate_route(two_waypoints)
            assert exc_info.value.status_code == 502

    @pytest.mark.asyncio
    async def test_handles_three_waypoints(self, osrm_service, three_waypoints):
        """Route calculation works with more than 2 waypoints."""
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "code": "Ok",
            "routes": [
                {
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [-80.84, 35.22],
                            [-80.82, 35.23],
                            [-80.79, 35.24],
                        ],
                    },
                    "distance": 8000.0,
                    "duration": 600.0,
                }
            ],
            "waypoints": [
                {"location": [-80.84, 35.22]},
                {"location": [-80.82, 35.23]},
                {"location": [-80.79, 35.24]},
            ],
        }

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=response)

        with patch(
            "api.services.osrm_service.httpx.AsyncClient", return_value=mock_client
        ):
            result = await osrm_service.calculate_route(three_waypoints)

        assert len(result.waypoints) == 3
        # URL should contain all 3 coordinate pairs
        url = mock_client.get.call_args[0][0]
        assert url.count(";") == 2


class TestOSRMServiceHealth:
    """Tests for OSRMService.health_check()."""

    @pytest.mark.asyncio
    async def test_returns_available_when_osrm_up(self, osrm_service):
        """Health check returns available when OSRM responds."""
        response = MagicMock()
        response.status_code = 200

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=response)

        with patch(
            "api.services.osrm_service.httpx.AsyncClient", return_value=mock_client
        ):
            result = await osrm_service.health_check()

        assert result.osrm_available is True
        assert result.osrm_version == "5.27.1"

    @pytest.mark.asyncio
    async def test_returns_unavailable_on_connection_error(self, osrm_service):
        """Health check returns unavailable when OSRM is down."""
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(
            side_effect=httpx.ConnectError("Connection refused")
        )

        with patch(
            "api.services.osrm_service.httpx.AsyncClient", return_value=mock_client
        ):
            result = await osrm_service.health_check()

        assert result.osrm_available is False
        assert result.osrm_version is None


# ---------------------------------------------------------------------------
# Endpoint tests (via FastAPI TestClient)
# ---------------------------------------------------------------------------


class TestCalculateEndpoint:
    """Tests for POST /routing/calculate endpoint."""

    def test_returns_route(self, client, mock_osrm_response):
        """Valid request returns 200 with route geometry."""
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_osrm_response)

        with patch(
            "api.services.osrm_service.httpx.AsyncClient", return_value=mock_client
        ):
            response = client.post(
                "/routing/calculate",
                json={
                    "waypoints": [
                        {"lng": -80.8431, "lat": 35.2271},
                        {"lng": -80.7933, "lat": 35.2387},
                    ]
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert data["geometry"]["type"] == "LineString"
        assert len(data["geometry"]["coordinates"]) > 0
        assert "distance" in data
        assert "duration" in data
        assert len(data["waypoints"]) == 2

    def test_rejects_single_waypoint(self, client):
        """Single waypoint returns 422."""
        response = client.post(
            "/routing/calculate",
            json={"waypoints": [{"lng": -80.8431, "lat": 35.2271}]},
        )
        assert response.status_code == 422

    def test_rejects_empty_waypoints(self, client):
        """Empty waypoints returns 422."""
        response = client.post(
            "/routing/calculate",
            json={"waypoints": []},
        )
        assert response.status_code == 422

    def test_rejects_invalid_coordinates(self, client):
        """Invalid coordinates return 422."""
        response = client.post(
            "/routing/calculate",
            json={
                "waypoints": [
                    {"lng": "not-a-number", "lat": 35.2271},
                    {"lng": -80.7933, "lat": 35.2387},
                ]
            },
        )
        assert response.status_code == 422

    def test_rejects_out_of_range_coordinates(self, client):
        """Out-of-range coordinates return 422."""
        response = client.post(
            "/routing/calculate",
            json={
                "waypoints": [
                    {"lng": -200, "lat": 35.2271},
                    {"lng": -80.7933, "lat": 35.2387},
                ]
            },
        )
        assert response.status_code == 422

    def test_returns_503_when_osrm_unavailable(self, client):
        """OSRM unavailable returns 503."""
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(
            side_effect=httpx.ConnectError("Connection refused")
        )

        with patch(
            "api.services.osrm_service.httpx.AsyncClient", return_value=mock_client
        ):
            response = client.post(
                "/routing/calculate",
                json={
                    "waypoints": [
                        {"lng": -80.8431, "lat": 35.2271},
                        {"lng": -80.7933, "lat": 35.2387},
                    ]
                },
            )

        assert response.status_code == 503
        assert "unavailable" in response.json()["detail"].lower()

    def test_optional_segment_id(self, client, mock_osrm_response):
        """Waypoints with segment_id are accepted."""
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_osrm_response)

        with patch(
            "api.services.osrm_service.httpx.AsyncClient", return_value=mock_client
        ):
            response = client.post(
                "/routing/calculate",
                json={
                    "waypoints": [
                        {"lng": -80.8431, "lat": 35.2271, "segment_id": "seg_001"},
                        {"lng": -80.7933, "lat": 35.2387, "segment_id": "seg_002"},
                    ]
                },
            )

        assert response.status_code == 200


class TestHealthEndpoint:
    """Tests for GET /routing/health endpoint."""

    def test_returns_available(self, client):
        """Health returns available when OSRM is up."""
        response_mock = MagicMock()
        response_mock.status_code = 200

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=response_mock)

        with patch(
            "api.services.osrm_service.httpx.AsyncClient", return_value=mock_client
        ):
            response = client.get("/routing/health")

        assert response.status_code == 200
        data = response.json()
        assert data["osrm_available"] is True

    def test_returns_unavailable(self, client):
        """Health returns unavailable when OSRM is down."""
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(
            side_effect=httpx.ConnectError("Connection refused")
        )

        with patch(
            "api.services.osrm_service.httpx.AsyncClient", return_value=mock_client
        ):
            response = client.get("/routing/health")

        assert response.status_code == 200
        data = response.json()
        assert data["osrm_available"] is False


# ---------------------------------------------------------------------------
# Pydantic model validation tests
# ---------------------------------------------------------------------------


class TestRoutingModels:
    """Tests for routing Pydantic models."""

    def test_waypoint_valid(self):
        wp = WaypointRequest(lng=-80.84, lat=35.22)
        assert wp.lng == -80.84
        assert wp.lat == 35.22
        assert wp.segment_id is None

    def test_waypoint_with_segment_id(self):
        wp = WaypointRequest(lng=-80.84, lat=35.22, segment_id="seg_001")
        assert wp.segment_id == "seg_001"

    def test_waypoint_rejects_invalid_lng(self):
        with pytest.raises(Exception):
            WaypointRequest(lng=-200, lat=35.22)

    def test_waypoint_rejects_invalid_lat(self):
        with pytest.raises(Exception):
            WaypointRequest(lng=-80.84, lat=100)

    def test_calculate_request_requires_two_waypoints(self):
        with pytest.raises(Exception):
            CalculateRouteRequest(waypoints=[WaypointRequest(lng=-80.84, lat=35.22)])

    def test_calculate_request_accepts_two_waypoints(self):
        req = CalculateRouteRequest(
            waypoints=[
                WaypointRequest(lng=-80.84, lat=35.22),
                WaypointRequest(lng=-80.79, lat=35.24),
            ]
        )
        assert len(req.waypoints) == 2
