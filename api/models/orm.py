"""
SQLAlchemy ORM models for database tables.

These models correspond to the schema in api/schema/saved_routes.sql
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from datetime import datetime
import uuid

Base = declarative_base()


class RouteSession(Base):
    """
    User session for route building.

    Simple session management without authentication.
    Allows tracking routes per user/browser session.
    """

    __tablename__ = "route_sessions"

    session_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_accessed = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    session_name = Column(String(255), nullable=True)

    # Relationships
    routes = relationship(
        "SavedRoute", back_populates="session", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return (
            f"<RouteSession(session_id={self.session_id}, created={self.created_at})>"
        )


class SavedRoute(Base):
    """
    A user-created route built by stitching road segments together.

    Stores both the complete route data in JSONB (preserving all segment details)
    and normalized geometry for spatial queries.
    """

    __tablename__ = "saved_routes"

    route_id = Column(Integer, primary_key=True)
    session_id = Column(
        UUID(as_uuid=True), ForeignKey("route_sessions.session_id", ondelete="CASCADE")
    )
    route_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Aggregated statistics
    total_curvature = Column(Float)
    total_length = Column(Float)  # meters
    segment_count = Column(Integer)

    # Geometry and data storage
    geom = Column(Geometry("LINESTRING", srid=4326))  # PostGIS LineString
    route_data = Column(JSONB)  # Complete segment data

    # Sharing
    url_slug = Column(String(50), unique=True)
    is_public = Column(Boolean, default=False)

    # Waypoint routing fields
    connecting_geometry = Column(Geometry("LINESTRING", srid=4326), nullable=True)
    route_type = Column(String(20), default="segment_list")  # "segment_list" or "waypoint"

    # Relationships
    session = relationship("RouteSession", back_populates="routes")
    segments = relationship(
        "RouteSegment",
        back_populates="route",
        cascade="all, delete-orphan",
        order_by="RouteSegment.position",
    )
    waypoints = relationship(
        "RouteWaypoint",
        back_populates="route",
        cascade="all, delete-orphan",
        order_by="RouteWaypoint.waypoint_order",
    )

    def __repr__(self):
        return f"<SavedRoute(id={self.route_id}, name='{self.route_name}', segments={self.segment_count})>"

    @property
    def length_km(self):
        """Route length in kilometers"""
        return self.total_length / 1000 if self.total_length else 0

    @property
    def length_mi(self):
        """Route length in miles"""
        return self.total_length / 1609.34 if self.total_length else 0


class RouteSegment(Base):
    """
    Individual segment within a saved route.

    Normalized storage for querying. Position indicates order in the route.
    Complete segment data is also preserved in SavedRoute.route_data JSONB field.
    """

    __tablename__ = "route_segments"
    __table_args__ = (
        UniqueConstraint("route_id", "position", name="uq_route_segment_position"),
    )

    id = Column(Integer, primary_key=True)
    route_id = Column(Integer, ForeignKey("saved_routes.route_id", ondelete="CASCADE"))
    position = Column(Integer, nullable=False)  # Order in route (1, 2, 3...)

    # Segment geometry
    start_lat = Column(Float)
    start_lon = Column(Float)
    end_lat = Column(Float)
    end_lon = Column(Float)

    # Segment metrics
    length = Column(Float)  # meters
    radius = Column(Float)  # meters (circumcircle radius)
    curvature = Column(Float)  # weighted curvature value
    curvature_level = Column(Integer)  # 0-4 (0=straight, 4=sharp)

    # Source OSM data
    source_way_id = Column(Integer)  # OSM way ID
    way_name = Column(String(500), nullable=True)
    highway_type = Column(String(100), nullable=True)
    surface_type = Column(String(100), nullable=True)

    # Relationships
    route = relationship("SavedRoute", back_populates="segments")

    def __repr__(self):
        return f"<RouteSegment(id={self.id}, route={self.route_id}, pos={self.position}, curve={self.curvature})>"

    @property
    def length_m(self):
        """Segment length in meters"""
        return self.length if self.length else 0


class RouteWaypoint(Base):
    """
    An ordered waypoint within a waypoint-based route.

    Waypoints are created when a user clicks curvature segments (snapping to
    segment endpoints) or drags existing waypoints. OSRM uses these waypoints
    to calculate the connecting road-snapped route geometry.
    """

    __tablename__ = "route_waypoints"
    __table_args__ = (
        UniqueConstraint(
            "route_id", "waypoint_order", name="unique_route_waypoint_order"
        ),
    )

    id = Column(Integer, primary_key=True)
    route_id = Column(
        Integer, ForeignKey("saved_routes.route_id", ondelete="CASCADE")
    )
    waypoint_order = Column(Integer, nullable=False)
    lng = Column(Float, nullable=False)
    lat = Column(Float, nullable=False)
    segment_id = Column(String(255), nullable=True)
    is_user_modified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    route = relationship("SavedRoute", back_populates="waypoints")

    def __repr__(self):
        return f"<RouteWaypoint(id={self.id}, route={self.route_id}, order={self.waypoint_order}, lng={self.lng}, lat={self.lat})>"
