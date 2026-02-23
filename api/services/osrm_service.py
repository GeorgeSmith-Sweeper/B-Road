"""
Service layer for OSRM routing engine communication.

Uses async httpx to communicate with the OSRM backend service.
"""

import os
import httpx

from api.models.routing import (
    CalculateRouteResponse,
    RouteGeometry,
    SnappedWaypoint,
    RoutingHealthResponse,
    WaypointRequest,
)

OSRM_URL = os.getenv("OSRM_URL", "http://localhost:5000")
OSRM_TIMEOUT = int(os.getenv("OSRM_TIMEOUT", "30"))


class OSRMError(Exception):
    """Raised when OSRM returns an error or is unavailable."""

    def __init__(self, message: str, status_code: int = 503):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class OSRMService:
    """Async client for the OSRM routing engine."""

    def __init__(self, base_url: str = OSRM_URL, timeout: int = OSRM_TIMEOUT):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    async def calculate_route(
        self, waypoints: list[WaypointRequest]
    ) -> CalculateRouteResponse:
        """
        Calculate a route between waypoints using OSRM.

        Args:
            waypoints: List of at least 2 waypoints with lng/lat coordinates.

        Returns:
            CalculateRouteResponse with geometry, distance, duration, and snapped waypoints.

        Raises:
            OSRMError: If OSRM is unavailable or returns an error.
        """
        # Build OSRM coordinate string: lng,lat;lng,lat;...
        coords = ";".join(f"{wp.lng},{wp.lat}" for wp in waypoints)
        url = f"{self.base_url}/route/v1/driving/{coords}"

        params = {
            "overview": "full",
            "geometries": "geojson",
            "steps": "false",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params=params)
        except httpx.ConnectError:
            raise OSRMError("Routing service is unavailable. Is OSRM running?")
        except httpx.TimeoutException:
            raise OSRMError("Routing service timed out.")

        if response.status_code != 200:
            raise OSRMError(
                f"Routing service returned status {response.status_code}.",
                status_code=502,
            )

        data = response.json()

        if data.get("code") != "Ok":
            message = data.get("message", "Unknown routing error")
            raise OSRMError(f"Routing failed: {message}", status_code=422)

        route = data["routes"][0]
        osrm_waypoints = data.get("waypoints", [])

        return CalculateRouteResponse(
            geometry=RouteGeometry(
                type="LineString",
                coordinates=route["geometry"]["coordinates"],
            ),
            distance=route["distance"],
            duration=route["duration"],
            waypoints=[
                SnappedWaypoint(
                    lng=wp["location"][0],
                    lat=wp["location"][1],
                )
                for wp in osrm_waypoints
            ],
        )

    async def health_check(self) -> RoutingHealthResponse:
        """
        Check if OSRM is reachable and responding.

        Returns:
            RoutingHealthResponse with availability status.
        """
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                # Use a simple route request to verify OSRM is working
                response = await client.get(
                    f"{self.base_url}/route/v1/driving/-80.8,35.2;-80.7,35.3",
                    params={"overview": "false"},
                )
                available = response.status_code == 200
        except (httpx.ConnectError, httpx.TimeoutException):
            available = False

        return RoutingHealthResponse(
            osrm_available=available,
            osrm_version="5.27.1" if available else None,
        )
