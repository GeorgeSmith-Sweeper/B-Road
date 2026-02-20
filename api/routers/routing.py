"""
FastAPI router for OSRM routing endpoints.

Provides route calculation between waypoints using the OSRM
routing engine, returning GeoJSON geometries that follow the
road network.
"""

from fastapi import APIRouter, HTTPException

from api.models.routing import (
    CalculateRouteRequest,
    CalculateRouteResponse,
    RoutingHealthResponse,
)
from api.services.osrm_service import OSRMService, OSRMError

router = APIRouter(prefix="/routing", tags=["routing"])


def get_osrm_service() -> OSRMService:
    """Dependency for OSRM service."""
    return OSRMService()


@router.post("/calculate", response_model=CalculateRouteResponse)
async def calculate_route(request: CalculateRouteRequest):
    """
    Calculate a route between waypoints via the road network.

    Requires at least 2 waypoints. Returns a GeoJSON LineString
    geometry following the road network, plus distance and duration.
    """
    service = get_osrm_service()
    try:
        return await service.calculate_route(request.waypoints)
    except OSRMError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/health", response_model=RoutingHealthResponse)
async def routing_health():
    """
    Check OSRM routing engine availability.

    Returns whether OSRM is reachable and responding to requests.
    """
    service = get_osrm_service()
    return await service.health_check()
