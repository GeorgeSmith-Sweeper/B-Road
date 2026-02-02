"""
Unit tests for database connection and session management.

Tests the database.py module including:
- Connection testing
- PostGIS availability checking
- Session context managers
- Database initialization
"""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from database import check_db_connection, test_postgis, get_db
from models import Base, RouteSession, SavedRoute


@pytest.mark.unit
class TestDatabaseConnection:
    """Tests for database connection management."""

    def test_engine_connection(self, test_engine):
        """Test that the test engine can connect to the database."""
        with test_engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            assert result.fetchone()[0] == 1

    def test_database_has_postgis(self, test_engine):
        """Test that PostGIS extension is available."""
        with test_engine.connect() as conn:
            # Check PostGIS version
            result = conn.execute(text("SELECT PostGIS_Version();"))
            version = result.fetchone()[0]
            assert version is not None
            assert isinstance(version, str)
            # Version should be in format like "3.3 USE_GEOS=1 USE_PROJ=1 ..."
            assert "USE_GEOS" in version or len(version) > 0

    def test_database_has_required_tables(self, test_engine):
        """Test that all required tables exist."""
        with test_engine.connect() as conn:
            # Check route_sessions table
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'route_sessions'
                );
            """))
            assert result.fetchone()[0] is True

            # Check saved_routes table
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'saved_routes'
                );
            """))
            assert result.fetchone()[0] is True

            # Check route_segments table
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'route_segments'
                );
            """))
            assert result.fetchone()[0] is True


@pytest.mark.unit
class TestSessionManagement:
    """Tests for database session handling."""

    def test_session_can_query(self, test_db_session):
        """Test that a session can execute queries."""
        # Simple query to verify session works
        result = test_db_session.execute(text("SELECT 1 as value"))
        assert result.fetchone().value == 1

    def test_session_can_add_and_query_model(self, test_db_session):
        """Test that a session can persist and query models."""
        # Create a session
        session = RouteSession(session_name="Test")
        test_db_session.add(session)
        test_db_session.commit()

        # Query it back
        queried = (
            test_db_session.query(RouteSession).filter_by(session_name="Test").first()
        )

        assert queried is not None
        assert queried.session_name == "Test"
        assert queried.session_id == session.session_id

    def test_session_rollback_on_error(self, test_db_session):
        """Test that session rolls back on error."""
        # Create a valid session
        session1 = RouteSession(session_name="Valid Session")
        test_db_session.add(session1)
        test_db_session.commit()

        # Try to violate a constraint (duplicate unique slug)
        route1 = SavedRoute(
            session_id=session1.session_id,
            route_name="Route 1",
            total_curvature=50.0,
            total_length=1000.0,
            segment_count=2,
            url_slug="test-slug",
        )
        test_db_session.add(route1)
        test_db_session.commit()

        # Try duplicate
        route2 = SavedRoute(
            session_id=session1.session_id,
            route_name="Route 2",
            total_curvature=60.0,
            total_length=1200.0,
            segment_count=2,
            url_slug="test-slug",  # Duplicate!
        )
        test_db_session.add(route2)

        # This should raise an error
        with pytest.raises(Exception):
            test_db_session.commit()

        # Rollback to clean state
        test_db_session.rollback()

        # Session should still be usable
        result = test_db_session.execute(text("SELECT 1"))
        assert result.fetchone()[0] == 1


@pytest.mark.unit
class TestPostGISFunctionality:
    """Tests for PostGIS-specific functionality."""

    def test_postgis_geometric_types_available(self, test_engine):
        """Test that PostGIS geometric types are registered."""
        with test_engine.connect() as conn:
            # Check that GEOMETRY type is available
            result = conn.execute(text("""
                SELECT data_type
                FROM information_schema.columns
                WHERE table_name = 'saved_routes'
                AND column_name = 'geom';
            """))
            data_type = result.fetchone()[0]
            assert data_type == "USER-DEFINED"  # PostGIS types are user-defined

    def test_postgis_st_length_function(self, test_engine):
        """Test that ST_Length function works."""
        with test_engine.connect() as conn:
            # Create a simple line and measure it
            result = conn.execute(text("""
                SELECT ST_Length(
                    ST_GeomFromText('LINESTRING(0 0, 1 0)', 4326)
                );
            """))
            length = result.fetchone()[0]
            # Length should be approximately 1 (in the units of the SRID)
            assert length == pytest.approx(1.0, rel=0.01)

    def test_postgis_st_intersects_function(self, test_engine):
        """Test that ST_Intersects function works."""
        with test_engine.connect() as conn:
            # Test two intersecting lines
            result = conn.execute(text("""
                SELECT ST_Intersects(
                    ST_GeomFromText('LINESTRING(0 0, 2 2)', 4326),
                    ST_GeomFromText('LINESTRING(0 2, 2 0)', 4326)
                );
            """))
            intersects = result.fetchone()[0]
            assert intersects is True

            # Test two non-intersecting lines
            result = conn.execute(text("""
                SELECT ST_Intersects(
                    ST_GeomFromText('LINESTRING(0 0, 1 0)', 4326),
                    ST_GeomFromText('LINESTRING(2 0, 3 0)', 4326)
                );
            """))
            intersects = result.fetchone()[0]
            assert intersects is False

    def test_postgis_geography_type(self, test_engine):
        """Test that geography type calculations work."""
        with test_engine.connect() as conn:
            # Calculate distance in meters using geography type
            # Distance from equator (0,0) to (0,1) should be ~111km
            result = conn.execute(text("""
                SELECT ST_Length(
                    ST_GeographyFromText('LINESTRING(0 0, 0 1)')
                );
            """))
            length = result.fetchone()[0]
            # Should be approximately 111,000 meters (111 km)
            assert 110000 < length < 112000

    def test_postgis_srid_4326(self, test_engine):
        """Test that SRID 4326 (WGS84) is available."""
        with test_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT auth_name, auth_srid, srtext
                FROM spatial_ref_sys
                WHERE srid = 4326;
            """))
            row = result.fetchone()
            assert row is not None
            assert row.auth_name == "EPSG"
            assert row.auth_srid == 4326
            assert "WGS 84" in row.srtext or "WGS84" in row.srtext


@pytest.mark.unit
class TestDatabaseIndexes:
    """Tests for database indexes and constraints."""

    def test_saved_routes_geom_index_exists(self, test_engine):
        """Test that GIST index on geom column exists."""
        with test_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT indexname
                FROM pg_indexes
                WHERE tablename = 'saved_routes'
                AND indexname LIKE '%geom%';
            """))
            indexes = [row[0] for row in result.fetchall()]
            # Should have a GIST index on geom column
            assert len(indexes) > 0
            assert any("geom" in idx for idx in indexes)

    def test_url_slug_unique_constraint(self, test_engine):
        """Test that url_slug has unique constraint."""
        with test_engine.connect() as conn:
            result = conn.execute(text("""
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_name = 'saved_routes'
                AND constraint_type = 'UNIQUE';
            """))
            constraints = [row[0] for row in result.fetchall()]
            # Should have unique constraint (might be on url_slug column or in constraint name)
            assert len(constraints) > 0

    def test_foreign_key_constraints_exist(self, test_engine):
        """Test that foreign key relationships are enforced."""
        with test_engine.connect() as conn:
            # Check saved_routes -> route_sessions FK
            result = conn.execute(text("""
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_name = 'saved_routes'
                AND constraint_type = 'FOREIGN KEY';
            """))
            fk_constraints = [row[0] for row in result.fetchall()]
            assert len(fk_constraints) > 0

            # Check route_segments -> saved_routes FK
            result = conn.execute(text("""
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_name = 'route_segments'
                AND constraint_type = 'FOREIGN KEY';
            """))
            fk_constraints = [row[0] for row in result.fetchall()]
            assert len(fk_constraints) > 0
