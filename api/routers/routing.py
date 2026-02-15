"""
FastAPI router for OSRM routing endpoints.

Provides route calculation between waypoints using the OSRM
routing engine, returning GeoJSON geometries that follow the
road network. Includes a curvy route finder that maximizes
time on high-curvature paved roads.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.database import get_db_session
from api.models.routing import (
    CalculateRouteRequest,
    CalculateRouteResponse,
    RoutingHealthResponse,
)
from api.models.curvy_routing import CurvyRouteRequest, CurvyRouteResponse
from api.services.osrm_service import OSRMService, OSRMError
from api.services.curvy_route_service import CurvyRouteService

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


@router.post("/curvy-route", response_model=CurvyRouteResponse)
async def find_curvy_route(
    request: CurvyRouteRequest,
    db: Session = Depends(get_db_session),
):
    """
    Find a route that maximizes time on curvy paved roads.

    Given start and end points, calculates a baseline OSRM route, finds
    high-curvature segments within a corridor, and injects them as
    waypoints to create a route that prioritizes curvy roads.
    """
    osrm = get_osrm_service()
    service = CurvyRouteService(db=db, osrm_service=osrm)
    try:
        return await service.find_curvy_route(request)
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
