"""
Pydantic models for OSRM routing request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List


class WaypointRequest(BaseModel):
    """A single waypoint for route calculation."""

    lng: float = Field(..., ge=-180, le=180)
    lat: float = Field(..., ge=-90, le=90)
    segment_id: Optional[str] = None


class CalculateRouteRequest(BaseModel):
    """Request body for route calculation."""

    waypoints: List[WaypointRequest] = Field(..., min_length=2)


class SnappedWaypoint(BaseModel):
    """A waypoint snapped to the road network by OSRM."""

    lng: float
    lat: float
    snapped: bool = True


class RouteGeometry(BaseModel):
    """GeoJSON LineString geometry for a calculated route."""

    type: str = "LineString"
    coordinates: List[List[float]]


class CalculateRouteResponse(BaseModel):
    """Response from route calculation."""

    geometry: RouteGeometry
    distance: float  # meters
    duration: float  # seconds
    waypoints: List[SnappedWaypoint]


class GapRequest(BaseModel):
    """A single gap between segments that needs OSRM routing."""

    gap_index: int
    waypoints: List[WaypointRequest] = Field(..., min_length=2)


class CalculateGapsRequest(BaseModel):
    """Request body for multi-gap route calculation."""

    gaps: List[GapRequest] = Field(..., min_length=1)


class GapResponse(BaseModel):
    """OSRM route result for a single gap."""

    gap_index: int
    geometry: RouteGeometry
    distance: float  # meters
    duration: float  # seconds


class CalculateGapsResponse(BaseModel):
    """Response from multi-gap route calculation."""

    gaps: List[GapResponse]
    total_distance: float  # meters
    total_duration: float  # seconds


class RoutingHealthResponse(BaseModel):
    """Response from routing health check."""

    osrm_available: bool
    osrm_version: Optional[str] = None
