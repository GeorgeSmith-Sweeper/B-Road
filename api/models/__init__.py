"""
Models package - provides both ORM and schema models.

For backwards compatibility, this __init__.py re-exports all models.
"""

# SQLAlchemy ORM models
from api.models.orm import Base, RouteSession, SavedRoute, RouteSegment

# Pydantic schema models
from api.models.schemas import (
    SegmentData,
    SaveRouteRequest,
    UpdateRouteRequest,
    RouteResponse,
    RouteDetailResponse,
    SaveRouteResponse,
    SessionResponse,
    RouteListResponse
)

__all__ = [
    # ORM models
    'Base',
    'RouteSession',
    'SavedRoute',
    'RouteSegment',
    # Schema models
    'SegmentData',
    'SaveRouteRequest',
    'UpdateRouteRequest',
    'RouteResponse',
    'RouteDetailResponse',
    'SaveRouteResponse',
    'SessionResponse',
    'RouteListResponse',
]
