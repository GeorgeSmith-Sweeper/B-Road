"""
Pytest configuration and shared fixtures for B-Road API tests.

This file provides:
- Database fixtures with PostGIS support
- FastAPI test client
- Sample data fixtures for routes and segments
"""

import os
import pytest
import uuid
from datetime import datetime
from typing import Generator
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from shapely.geometry import LineString
from geoalchemy2.shape import from_shape

# Import app and models
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from server import app
from models import Base, RouteSession, SavedRoute, RouteSegment
from database import get_db, get_db_session

# Import test data fixtures
from tests.fixtures.sample_segments import (
    CONNECTED_SEGMENTS,
    DISCONNECTED_SEGMENTS,
    SINGLE_SEGMENT,
    SAMPLE_ROUTE_METADATA,
    CONNECTED_SEGMENTS_STATS
)


# Database connection configuration for tests
TEST_DB_NAME = os.getenv('TEST_DB_NAME', 'curvature_test')
TEST_DB_USER = os.getenv('TEST_DB_USER', 'postgres')
TEST_DB_PASSWORD = os.getenv('TEST_DB_PASSWORD', '')
TEST_DB_HOST = os.getenv('TEST_DB_HOST', 'localhost')
TEST_DB_PORT = os.getenv('TEST_DB_PORT', '5432')


@pytest.fixture(scope="session")
def postgresql_proc():
    """
    Create test database with PostGIS extension (session scope).

    This fixture runs once per test session and sets up a clean database
    with PostGIS support.
    """
    # Connection string for postgres (default) database
    admin_conn_str = f"host={TEST_DB_HOST} port={TEST_DB_PORT} user={TEST_DB_USER} password={TEST_DB_PASSWORD} dbname=postgres"

    # Connect to postgres database to create test database
    conn = psycopg2.connect(admin_conn_str)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()

    try:
        # Drop test database if it exists (cleanup from previous runs)
        cursor.execute(f"DROP DATABASE IF EXISTS {TEST_DB_NAME}")

        # Create test database
        cursor.execute(f"CREATE DATABASE {TEST_DB_NAME}")

        cursor.close()
        conn.close()

        # Connect to new test database to enable PostGIS
        test_conn_str = f"host={TEST_DB_HOST} port={TEST_DB_PORT} user={TEST_DB_USER} password={TEST_DB_PASSWORD} dbname={TEST_DB_NAME}"
        conn = psycopg2.connect(test_conn_str)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        # Enable PostGIS extension
        cursor.execute("CREATE EXTENSION IF NOT EXISTS postgis")

        cursor.close()
        conn.close()

        yield {
            'host': TEST_DB_HOST,
            'port': TEST_DB_PORT,
            'user': TEST_DB_USER,
            'password': TEST_DB_PASSWORD,
            'dbname': TEST_DB_NAME
        }

    finally:
        # Cleanup: drop test database after all tests
        conn = psycopg2.connect(admin_conn_str)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        # Terminate connections to test database
        cursor.execute(f"""
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = '{TEST_DB_NAME}'
            AND pid <> pg_backend_pid()
        """)

        cursor.execute(f"DROP DATABASE IF EXISTS {TEST_DB_NAME}")
        cursor.close()
        conn.close()


@pytest.fixture(scope="session")
def test_engine(postgresql_proc):
    """
    Create SQLAlchemy engine for test database (session scope).

    Returns an engine connected to the test database with PostGIS enabled.
    """
    db_url = f"postgresql://{postgresql_proc['user']}:{postgresql_proc['password']}@{postgresql_proc['host']}:{postgresql_proc['port']}/{postgresql_proc['dbname']}"

    engine = create_engine(db_url, pool_pre_ping=True, echo=False)

    # Create all tables
    Base.metadata.create_all(bind=engine)

    yield engine

    # Cleanup: drop all tables after session
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def test_db_session(test_engine) -> Generator[Session, None, None]:
    """
    Create a database session for a single test (function scope).

    Each test gets a clean database state with automatic rollback.
    This ensures test isolation.
    """
    # Create a connection
    connection = test_engine.connect()

    # Begin a transaction
    transaction = connection.begin()

    # Create a session bound to the connection
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=connection)
    session = TestSessionLocal()

    yield session

    # Rollback transaction and close connection after test
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def test_client(test_db_session):
    """
    Create FastAPI TestClient with overridden database dependency.

    This client uses the test database session instead of the production one.
    """
    # Override the get_db_session dependency to use test database
    # Note: Routers use get_db_session, not get_db
    def override_get_db_session():
        try:
            yield test_db_session
        finally:
            pass  # Session cleanup handled by test_db_session fixture

    app.dependency_overrides[get_db_session] = override_get_db_session

    with TestClient(app) as client:
        yield client

    # Clear overrides after test
    app.dependency_overrides.clear()


@pytest.fixture
def sample_session(test_db_session) -> RouteSession:
    """
    Create a sample RouteSession for testing.

    Returns a persisted RouteSession object.
    """
    session = RouteSession(
        session_name="Test Session"
    )
    test_db_session.add(session)
    test_db_session.commit()
    test_db_session.refresh(session)
    return session


@pytest.fixture
def sample_route(test_db_session, sample_session) -> SavedRoute:
    """
    Create a sample SavedRoute with geometry for testing.

    Uses CONNECTED_SEGMENTS to create a realistic route.
    Returns a persisted SavedRoute object.
    """
    # Build LineString geometry from connected segments
    coords = []
    for idx, seg in enumerate(CONNECTED_SEGMENTS):
        if idx == 0:
            coords.append((seg["start"][1], seg["start"][0]))  # lon, lat
        coords.append((seg["end"][1], seg["end"][0]))

    linestring = LineString(coords)

    # Create route
    route = SavedRoute(
        session_id=sample_session.session_id,
        route_name=SAMPLE_ROUTE_METADATA["route_name"],
        description=SAMPLE_ROUTE_METADATA["description"],
        total_curvature=CONNECTED_SEGMENTS_STATS["total_curvature"],
        total_length=CONNECTED_SEGMENTS_STATS["total_length"],
        segment_count=CONNECTED_SEGMENTS_STATS["segment_count"],
        geom=from_shape(linestring, srid=4326),
        route_data={'segments': CONNECTED_SEGMENTS},
        url_slug=f"test-mountain-loop-{uuid.uuid4().hex[:8]}",
        is_public=SAMPLE_ROUTE_METADATA["is_public"]
    )

    test_db_session.add(route)
    test_db_session.commit()
    test_db_session.refresh(route)

    return route


@pytest.fixture
def sample_segments(test_db_session, sample_route) -> list[RouteSegment]:
    """
    Create sample RouteSegments for testing.

    Creates segments associated with the sample_route.
    Returns a list of persisted RouteSegment objects.
    """
    segments = []

    for idx, seg_data in enumerate(CONNECTED_SEGMENTS):
        segment = RouteSegment(
            route_id=sample_route.route_id,
            position=idx + 1,
            start_lat=seg_data["start"][0],
            start_lon=seg_data["start"][1],
            end_lat=seg_data["end"][0],
            end_lon=seg_data["end"][1],
            length=seg_data["length"],
            radius=seg_data["radius"],
            curvature=seg_data["curvature"],
            curvature_level=seg_data["curvature_level"],
            source_way_id=seg_data["way_id"],
            way_name=seg_data["name"],
            highway_type=seg_data["highway"],
            surface_type=seg_data["surface"]
        )
        test_db_session.add(segment)
        segments.append(segment)

    test_db_session.commit()

    # Refresh all segments
    for segment in segments:
        test_db_session.refresh(segment)

    return segments


@pytest.fixture
def verify_postgis(test_engine):
    """
    Verify that PostGIS is available and working.

    This is a sanity check fixture that can be used in tests that require PostGIS.
    """
    with test_engine.connect() as conn:
        result = conn.execute(text("SELECT PostGIS_Version();"))
        version = result.fetchone()[0]
        assert version is not None, "PostGIS not available"
        return version


@pytest.fixture
def clean_database(test_db_session):
    """
    Ensure database is clean before test.

    Deletes all data from tables. Useful for tests that need a completely empty database.
    """
    # Delete in reverse order to respect foreign key constraints
    test_db_session.query(RouteSegment).delete()
    test_db_session.query(SavedRoute).delete()
    test_db_session.query(RouteSession).delete()
    test_db_session.commit()

    yield

    # Cleanup handled by test_db_session rollback


# Utility functions for tests

def assert_segments_connected(segments: list) -> bool:
    """
    Assert that a list of segment dictionaries are connected end-to-end.

    Args:
        segments: List of segment dicts with 'start' and 'end' keys

    Returns:
        True if all segments connect, raises AssertionError otherwise
    """
    for i in range(len(segments) - 1):
        current_end = segments[i]["end"]
        next_start = segments[i + 1]["start"]
        assert current_end == next_start, f"Segment {i} end {current_end} != Segment {i+1} start {next_start}"
    return True


def create_test_linestring(segments: list) -> LineString:
    """
    Create a Shapely LineString from a list of segment dictionaries.

    Args:
        segments: List of segment dicts with 'start' and 'end' coordinates

    Returns:
        Shapely LineString object
    """
    coords = []
    for idx, seg in enumerate(segments):
        if idx == 0:
            coords.append((seg["start"][1], seg["start"][0]))  # lon, lat
        coords.append((seg["end"][1], seg["end"][0]))
    return LineString(coords)
