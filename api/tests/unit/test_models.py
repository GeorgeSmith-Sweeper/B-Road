"""
Unit tests for SQLAlchemy models.

Tests RouteSession, SavedRoute, and RouteSegment models including:
- Model creation and persistence
- Relationships and cascade deletes
- Computed properties
- Geometry handling with GeoAlchemy2
"""

import pytest
import uuid
from datetime import datetime
from shapely.geometry import LineString
from geoalchemy2.shape import from_shape, to_shape
from sqlalchemy.exc import IntegrityError

from models import RouteSession, SavedRoute, RouteSegment
from tests.fixtures.sample_segments import CONNECTED_SEGMENTS, SAMPLE_ROUTE_METADATA


@pytest.mark.unit
class TestRouteSession:
    """Tests for RouteSession model."""

    def test_route_session_creation(self, test_db_session):
        """Test creating a RouteSession with auto-generated UUID."""
        session = RouteSession(session_name="Test Session")
        test_db_session.add(session)
        test_db_session.commit()

        assert session.session_id is not None
        assert isinstance(session.session_id, uuid.UUID)
        assert session.session_name == "Test Session"
        assert session.created_at is not None
        assert isinstance(session.created_at, datetime)
        assert session.last_accessed is not None

    def test_route_session_without_name(self, test_db_session):
        """Test creating a RouteSession without a name (optional field)."""
        session = RouteSession()
        test_db_session.add(session)
        test_db_session.commit()

        assert session.session_id is not None
        assert session.session_name is None

    def test_route_session_repr(self, test_db_session):
        """Test __repr__ method."""
        session = RouteSession(session_name="Test Session")
        test_db_session.add(session)
        test_db_session.commit()

        repr_str = repr(session)
        assert "RouteSession" in repr_str
        assert str(session.session_id) in repr_str


@pytest.mark.unit
class TestSavedRoute:
    """Tests for SavedRoute model."""

    def test_saved_route_with_geometry(self, test_db_session, sample_session):
        """Test creating a SavedRoute with PostGIS LineString geometry."""
        # Create LineString from coordinates
        coords = [(-72.575, 44.260), (-72.580, 44.265), (-72.585, 44.270)]
        linestring = LineString(coords)

        route = SavedRoute(
            session_id=sample_session.session_id,
            route_name="Test Route",
            description="A test route",
            total_curvature=100.0,
            total_length=1500.0,
            segment_count=3,
            geom=from_shape(linestring, srid=4326),
            route_data={"test": "data"},
            url_slug="test-route-abc123",
            is_public=False,
        )

        test_db_session.add(route)
        test_db_session.commit()
        test_db_session.refresh(route)

        assert route.route_id is not None
        assert route.route_name == "Test Route"
        assert route.total_curvature == 100.0
        assert route.geom is not None

        # Verify geometry can be converted back to Shapely
        shape = to_shape(route.geom)
        assert isinstance(shape, LineString)
        assert len(shape.coords) == 3

    def test_saved_route_url_slug_unique(self, test_db_session, sample_session):
        """Test that url_slug must be unique."""
        route1 = SavedRoute(
            session_id=sample_session.session_id,
            route_name="Route 1",
            total_curvature=50.0,
            total_length=1000.0,
            segment_count=2,
            url_slug="duplicate-slug",
        )
        test_db_session.add(route1)
        test_db_session.commit()

        # Try to create another route with same slug
        route2 = SavedRoute(
            session_id=sample_session.session_id,
            route_name="Route 2",
            total_curvature=60.0,
            total_length=1200.0,
            segment_count=2,
            url_slug="duplicate-slug",
        )
        test_db_session.add(route2)

        with pytest.raises(IntegrityError):
            test_db_session.commit()

    def test_saved_route_length_properties(self, test_db_session, sample_session):
        """Test length_km and length_mi computed properties."""
        route = SavedRoute(
            session_id=sample_session.session_id,
            route_name="Distance Test",
            total_curvature=50.0,
            total_length=5000.0,  # 5000 meters
            segment_count=5,
            url_slug="distance-test",
        )
        test_db_session.add(route)
        test_db_session.commit()

        assert route.length_km == pytest.approx(5.0, rel=0.01)  # 5 km
        assert route.length_mi == pytest.approx(3.107, rel=0.01)  # ~3.1 miles

    def test_saved_route_cascade_delete_from_session(
        self, test_db_session, sample_session, sample_route
    ):
        """Test that deleting a session cascades to routes."""
        route_id = sample_route.route_id

        # Delete the session
        test_db_session.delete(sample_session)
        test_db_session.commit()

        # Verify route was deleted
        deleted_route = (
            test_db_session.query(SavedRoute).filter_by(route_id=route_id).first()
        )
        assert deleted_route is None

    def test_saved_route_repr(self, test_db_session, sample_route):
        """Test __repr__ method."""
        repr_str = repr(sample_route)
        assert "SavedRoute" in repr_str
        assert str(sample_route.route_id) in repr_str
        assert sample_route.route_name in repr_str


@pytest.mark.unit
class TestRouteSegment:
    """Tests for RouteSegment model."""

    def test_route_segment_creation(self, test_db_session, sample_route):
        """Test creating a RouteSegment."""
        segment = RouteSegment(
            route_id=sample_route.route_id,
            position=1,
            start_lat=44.260,
            start_lon=-72.575,
            end_lat=44.265,
            end_lon=-72.580,
            length=500.0,
            radius=100.0,
            curvature=15.0,
            curvature_level=2,
            source_way_id=12345,
            way_name="Mountain Road",
            highway_type="tertiary",
            surface_type="paved",
        )

        test_db_session.add(segment)
        test_db_session.commit()

        assert segment.id is not None
        assert segment.position == 1
        assert segment.curvature == 15.0
        assert segment.way_name == "Mountain Road"

    def test_route_segment_position_unique_per_route(
        self, test_db_session, sample_route
    ):
        """Test that position must be unique within a route."""
        segment1 = RouteSegment(
            route_id=sample_route.route_id,
            position=1,
            start_lat=44.0,
            start_lon=-72.0,
            end_lat=44.1,
            end_lon=-72.1,
            length=100.0,
            radius=50.0,
            curvature=5.0,
            curvature_level=1,
        )
        test_db_session.add(segment1)
        test_db_session.commit()

        # Try to create another segment with same position
        segment2 = RouteSegment(
            route_id=sample_route.route_id,
            position=1,  # Duplicate position
            start_lat=44.1,
            start_lon=-72.1,
            end_lat=44.2,
            end_lon=-72.2,
            length=100.0,
            radius=50.0,
            curvature=5.0,
            curvature_level=1,
        )
        test_db_session.add(segment2)

        with pytest.raises(IntegrityError):
            test_db_session.commit()

    def test_route_segment_cascade_delete_from_route(
        self, test_db_session, sample_route, sample_segments
    ):
        """Test that deleting a route cascades to segments."""
        segment_ids = [seg.id for seg in sample_segments]

        # Delete the route
        test_db_session.delete(sample_route)
        test_db_session.commit()

        # Verify all segments were deleted
        for seg_id in segment_ids:
            deleted_segment = (
                test_db_session.query(RouteSegment).filter_by(id=seg_id).first()
            )
            assert deleted_segment is None

    def test_route_segment_length_property(self, test_db_session, sample_route):
        """Test length_m computed property."""
        segment = RouteSegment(
            route_id=sample_route.route_id,
            position=10,
            start_lat=44.0,
            start_lon=-72.0,
            end_lat=44.1,
            end_lon=-72.1,
            length=1234.5,
            radius=50.0,
            curvature=5.0,
            curvature_level=1,
        )
        test_db_session.add(segment)
        test_db_session.commit()

        assert segment.length_m == 1234.5

    def test_route_segment_repr(self, test_db_session, sample_segments):
        """Test __repr__ method."""
        segment = sample_segments[0]
        repr_str = repr(segment)
        assert "RouteSegment" in repr_str
        assert str(segment.id) in repr_str
        assert str(segment.route_id) in repr_str


@pytest.mark.unit
class TestModelRelationships:
    """Tests for model relationships."""

    def test_session_to_routes_relationship(self, test_engine, sample_session):
        """Test one-to-many relationship from RouteSession to SavedRoute."""
        from sqlalchemy.orm import sessionmaker

        TestSessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=test_engine
        )
        db = TestSessionLocal()
        try:
            # Create multiple routes for same session
            route1 = SavedRoute(
                session_id=sample_session.session_id,
                route_name="Route 1",
                total_curvature=50.0,
                total_length=1000.0,
                segment_count=2,
                url_slug="route-1-rel",
            )
            route2 = SavedRoute(
                session_id=sample_session.session_id,
                route_name="Route 2",
                total_curvature=60.0,
                total_length=1200.0,
                segment_count=3,
                url_slug="route-2-rel",
            )

            db.add_all([route1, route2])
            db.commit()

            # Query for the session fresh in this db session to test relationship
            fresh_session = (
                db.query(RouteSession)
                .filter_by(session_id=sample_session.session_id)
                .first()
            )
            assert len(fresh_session.routes) == 2
            route_names = {r.route_name for r in fresh_session.routes}
            assert route_names == {"Route 1", "Route 2"}
        finally:
            db.close()

    def test_route_to_segments_relationship(self, test_engine, sample_route):
        """Test one-to-many relationship from SavedRoute to RouteSegment."""
        from sqlalchemy.orm import sessionmaker

        TestSessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=test_engine
        )
        db = TestSessionLocal()
        try:
            # Create segments for route
            for i in range(3):
                seg = RouteSegment(
                    route_id=sample_route.route_id,
                    position=i + 1,
                    start_lat=44.0 + (i * 0.01),
                    start_lon=-72.0 + (i * 0.01),
                    end_lat=44.0 + ((i + 1) * 0.01),
                    end_lon=-72.0 + ((i + 1) * 0.01),
                    length=100.0,
                    radius=50.0,
                    curvature=5.0,
                    curvature_level=1,
                )
                db.add(seg)

            db.commit()

            # Query for the route fresh in this db session to test relationship
            fresh_route = (
                db.query(SavedRoute).filter_by(route_id=sample_route.route_id).first()
            )
            assert len(fresh_route.segments) == 3

            # Verify segments are ordered by position
            positions = [seg.position for seg in fresh_route.segments]
            assert positions == [1, 2, 3]
        finally:
            db.close()

    def test_segment_back_reference_to_route(
        self, test_engine, sample_route, sample_segments
    ):
        """Test back reference from RouteSegment to SavedRoute."""
        from sqlalchemy.orm import sessionmaker

        TestSessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=test_engine
        )
        db = TestSessionLocal()
        try:
            # Query for the segment fresh in this db session to test back reference
            fresh_segment = (
                db.query(RouteSegment).filter_by(id=sample_segments[0].id).first()
            )

            # Access route through segment relationship
            assert fresh_segment.route is not None
            assert fresh_segment.route.route_id == sample_route.route_id
            assert fresh_segment.route.route_name == sample_route.route_name
        finally:
            db.close()
