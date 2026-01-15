"""
Service layer for route operations.

Business logic for route CRUD operations extracted from server.py.
"""

from typing import Optional
import uuid
import hashlib
from datetime import datetime
from sqlalchemy.orm import Session
from shapely.geometry import LineString
from geoalchemy2.shape import from_shape

from api.models.orm import SavedRoute, RouteSegment
from api.models.schemas import (
    SaveRouteRequest,
    UpdateRouteRequest,
    RouteResponse,
    RouteDetailResponse,
    RouteListResponse,
    SaveRouteResponse,
)
from api.repositories.route_repository import RouteRepository
from api.repositories.session_repository import SessionRepository
from api.repositories.segment_repository import SegmentRepository


class RouteService:
    """Business logic for route operations."""

    def __init__(self, db: Session):
        self.db = db
        self.route_repo = RouteRepository(db)
        self.session_repo = SessionRepository(db)
        self.segment_repo = SegmentRepository(db)

    def save_route(
        self, request: SaveRouteRequest, session_id: str
    ) -> SaveRouteResponse:
        """
        Save a stitched route to the database.

        Business logic:
        - Validates session exists
        - Calculates route statistics
        - Builds PostGIS LineString geometry
        - Generates unique URL slug
        - Creates route and segments in transaction
        """
        # Validate session
        session_uuid = uuid.UUID(session_id)
        session = self.session_repo.get_by_id(session_uuid)
        if not session:
            raise ValueError("Session not found")

        # Calculate statistics
        total_curvature = sum(seg.curvature for seg in request.segments)
        total_length = sum(seg.length for seg in request.segments)
        segment_count = len(request.segments)

        # Build geometry
        coords = []
        for idx, seg in enumerate(request.segments):
            if idx == 0:
                coords.append((seg.start[1], seg.start[0]))  # lon, lat
            coords.append((seg.end[1], seg.end[0]))

        linestring = LineString(coords)

        # Generate URL slug
        url_slug = self._generate_url_slug(request.route_name, session_id)

        # Create route
        route = SavedRoute(
            session_id=session_uuid,
            route_name=request.route_name,
            description=request.description,
            total_curvature=total_curvature,
            total_length=total_length,
            segment_count=segment_count,
            geom=from_shape(linestring, srid=4326),
            route_data={"segments": [seg.model_dump() for seg in request.segments]},
            url_slug=url_slug,
            is_public=request.is_public,
        )

        route = self.route_repo.create_route(route)

        # Create segments
        route_segments = []
        for idx, seg in enumerate(request.segments):
            route_segment = RouteSegment(
                route_id=route.route_id,
                position=idx + 1,
                start_lat=seg.start[0],
                start_lon=seg.start[1],
                end_lat=seg.end[0],
                end_lon=seg.end[1],
                length=seg.length,
                radius=seg.radius,
                curvature=seg.curvature,
                curvature_level=seg.curvature_level,
                source_way_id=seg.way_id,
                way_name=seg.name,
                highway_type=seg.highway,
                surface_type=seg.surface,
            )
            route_segments.append(route_segment)

        self.segment_repo.create_segments(route_segments)

        return SaveRouteResponse(
            route_id=route.route_id, url_slug=url_slug, share_url=f"/routes/{url_slug}"
        )

    def get_route(self, identifier: str) -> RouteDetailResponse:
        """Get route details by ID or slug"""
        route = self.route_repo.get_by_id_or_slug(identifier)
        if not route:
            raise ValueError("Route not found")

        # Build GeoJSON
        coords = []
        for seg in sorted(route.segments, key=lambda s: s.position):
            if len(coords) == 0:
                coords.append([seg.start_lon, seg.start_lat])
            coords.append([seg.end_lon, seg.end_lat])

        return RouteDetailResponse(
            route_id=route.route_id,
            route_name=route.route_name,
            description=route.description,
            total_curvature=route.total_curvature,
            total_length_km=route.total_length / 1000,
            total_length_mi=route.total_length / 1609.34,
            segment_count=route.segment_count,
            url_slug=route.url_slug,
            created_at=route.created_at.isoformat(),
            is_public=route.is_public,
            geojson={
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": coords},
                "properties": {
                    "name": route.route_name,
                    "curvature": route.total_curvature,
                    "length_mi": route.total_length / 1609.34,
                },
            },
            segments=route.route_data["segments"],
        )

    def list_routes(self, session_id: str) -> RouteListResponse:
        """List all routes for a session"""
        session_uuid = uuid.UUID(session_id)
        routes = self.route_repo.get_by_session(session_uuid)

        route_responses = [
            RouteResponse(
                route_id=r.route_id,
                route_name=r.route_name,
                description=r.description,
                total_curvature=r.total_curvature,
                total_length_km=r.total_length / 1000,
                total_length_mi=r.total_length / 1609.34,
                segment_count=r.segment_count,
                url_slug=r.url_slug,
                created_at=r.created_at.isoformat(),
                is_public=r.is_public,
            )
            for r in routes
        ]

        return RouteListResponse(routes=route_responses)

    def update_route(
        self, route_id: int, session_id: str, request: UpdateRouteRequest
    ) -> dict:
        """Update route metadata"""
        session_uuid = uuid.UUID(session_id)
        route = self.route_repo.get_by_session_and_id(session_uuid, route_id)

        if not route:
            raise ValueError("Route not found or unauthorized")

        # Update fields
        if request.route_name is not None:
            route.route_name = request.route_name
        if request.description is not None:
            route.description = request.description
        if request.is_public is not None:
            route.is_public = request.is_public

        self.route_repo.update_route(route)

        return {"status": "success", "message": "Route updated"}

    def delete_route(self, route_id: int, session_id: str) -> dict:
        """Delete a saved route"""
        session_uuid = uuid.UUID(session_id)
        route = self.route_repo.get_by_session_and_id(session_uuid, route_id)

        if not route:
            raise ValueError("Route not found or unauthorized")

        self.route_repo.delete_route(route)

        return {"status": "success", "message": "Route deleted"}

    def _generate_url_slug(self, route_name: str, session_id: str) -> str:
        """Generate unique URL slug from route name"""
        slug_base = route_name.lower().replace(" ", "-")[:30]
        slug_base = "".join(c for c in slug_base if c.isalnum() or c == "-")
        slug_hash = hashlib.md5(
            f"{session_id}{route_name}{datetime.utcnow()}".encode()
        ).hexdigest()[:8]
        return f"{slug_base}-{slug_hash}"
