"""
Pydantic models for curvy route finding request/response validation.

The curvy route finder generates routes that maximize time on high-curvature
paved roads by injecting waypoints from curvature segments into OSRM routes.
"""

from pydantic import BaseModel, Field
from typing import Optional, List

from api.models.routing import WaypointRequest, RouteGeometry


class CurvyRouteOptions(BaseModel):
    """Tuning parameters for the curvy route algorithm."""

    corridor_width: int = Field(
        default=15000, ge=1000, le=50000,
        description="Corridor width in meters around baseline route",
    )
    min_curvature: int = Field(
        default=500, ge=300, le=5000,
        description="Minimum curvature score for candidate segments",
    )
    min_segment_length: int = Field(
        default=500, ge=0,
        description="Minimum segment length in meters",
    )
    max_waypoints: int = Field(
        default=20, ge=5, le=25,
        description="Maximum number of curvy waypoints to inject",
    )
    max_detour_ratio: float = Field(
        default=2.5, ge=1.1, le=5.0,
        description="Maximum allowed detour ratio vs baseline distance",
    )


class CurvyRouteRequest(BaseModel):
    """Request body for curvy route calculation."""

    start: WaypointRequest
    end: WaypointRequest
    options: CurvyRouteOptions = CurvyRouteOptions()


class CurvySegmentInfo(BaseModel):
    """Info about a curvy segment included in the route."""

    id: int
    name: Optional[str] = None
    curvature: int
    length: int
    score: float


class CurvyRouteResponse(BaseModel):
    """Response from curvy route calculation."""

    geometry: RouteGeometry
    distance: float  # meters
    duration: float  # seconds
    baseline_distance: float  # meters (direct route for comparison)
    baseline_duration: float  # seconds
    detour_ratio: float
    curvy_segments: List[CurvySegmentInfo]
    total_curvature_score: int
    waypoints_used: int
    corridor_width: int
    generated_waypoints: List[WaypointRequest]
