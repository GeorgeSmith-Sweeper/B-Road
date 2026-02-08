"""
Pydantic models for API request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List

# Request Models


class SegmentData(BaseModel):
    """Segment data for saving routes"""

    way_id: int
    start: List[float] = Field(..., min_length=2, max_length=2)
    end: List[float] = Field(..., min_length=2, max_length=2)
    length: float = Field(..., ge=0)
    radius: float = Field(..., ge=0)
    curvature: float = Field(..., ge=0)
    curvature_level: int = Field(..., ge=0, le=4)
    name: Optional[str] = None
    highway: Optional[str] = None
    surface: Optional[str] = None


class SaveRouteRequest(BaseModel):
    """Request body for saving a route"""

    route_name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    segments: List[SegmentData] = Field(..., min_length=1)
    is_public: bool = False


class UpdateRouteRequest(BaseModel):
    """Request body for updating route metadata"""

    route_name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_public: Optional[bool] = None


# Response Models


class RouteResponse(BaseModel):
    """Response for route queries"""

    route_id: int
    route_name: str
    description: Optional[str]
    total_curvature: float
    total_length_km: float
    total_length_mi: float
    segment_count: int
    url_slug: str
    created_at: str
    is_public: bool


class RouteDetailResponse(RouteResponse):
    """Detailed route response with GeoJSON and segments"""

    geojson: dict
    segments: List[dict]


class SaveRouteResponse(BaseModel):
    """Response after saving a route"""

    status: str = "success"
    route_id: int
    url_slug: str
    share_url: str


class SessionResponse(BaseModel):
    """Response after creating a session"""

    session_id: str
    created_at: str


class RouteListResponse(BaseModel):
    """Response for listing routes"""

    routes: List[RouteResponse]


# Chat Models


class ChatMessage(BaseModel):
    """A single message in a chat conversation."""

    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatSearchRequest(BaseModel):
    """Request body for natural language road search."""

    query: str = Field(..., min_length=1)
    limit: int = Field(10, ge=1, le=50)
    history: List[ChatMessage] = Field(default_factory=list)
