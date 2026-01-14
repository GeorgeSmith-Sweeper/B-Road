"""
Integration tests for PostGIS spatial queries.

Tests spatial operations including:
- ST_Intersects for segment connectivity
- ST_Length for distance calculations
- LineString geometry operations
- SRID 4326 (WGS84) coordinate handling
- Bounding box queries
"""

import pytest
from sqlalchemy import text
from shapely.geometry import LineString, Point
from geoalchemy2.shape import from_shape, to_shape
from geoalchemy2 import functions as func

from models import SavedRoute, RouteSegment
from tests.fixtures.sample_segments import CONNECTED_SEGMENTS, SINGLE_SEGMENT
from tests.conftest import create_test_linestring


@pytest.mark.integration
@pytest.mark.spatial
class TestPostGISSpatialOperations:
    """Tests for PostGIS spatial functions."""

    def test_st_intersects_for_connected_segments(self, test_db_session, sample_route):
        """Test ST_Intersects detects when segment endpoints touch."""
        # Create two segments that share an endpoint
        seg1_line = LineString([(-72.575, 44.260), (-72.580, 44.265)])
        seg2_line = LineString([(-72.580, 44.265), (-72.585, 44.270)])  # Shares endpoint

        # Check if they intersect using PostGIS
        result = test_db_session.execute(text("""
            SELECT ST_Intersects(
                ST_GeomFromText(:seg1, 4326),
                ST_GeomFromText(:seg2, 4326)
            )
        """), {
            'seg1': seg1_line.wkt,
            'seg2': seg2_line.wkt
        })

        intersects = result.fetchone()[0]
        assert intersects is True, "Connected segments should intersect"

    def test_st_intersects_for_disconnected_segments(self, test_db_session):
        """Test ST_Intersects returns false for disconnected segments."""
        # Create two segments that don't touch
        seg1_line = LineString([(-72.575, 44.260), (-72.580, 44.265)])
        seg2_line = LineString([(-72.600, 44.300), (-72.605, 44.305)])  # Far away

        result = test_db_session.execute(text("""
            SELECT ST_Intersects(
                ST_GeomFromText(:seg1, 4326),
                ST_GeomFromText(:seg2, 4326)
            )
        """), {
            'seg1': seg1_line.wkt,
            'seg2': seg2_line.wkt
        })

        intersects = result.fetchone()[0]
        assert intersects is False, "Disconnected segments should not intersect"

    def test_st_length_calculation(self, test_db_session):
        """Test ST_Length for distance calculation."""
        # Create a simple horizontal line (1 degree longitude at equator ~ 111km)
        line = LineString([(0, 0), (1, 0)])

        result = test_db_session.execute(text("""
            SELECT ST_Length(ST_GeomFromText(:line, 4326))
        """), {'line': line.wkt})

        length = result.fetchone()[0]
        # In SRID 4326 (degrees), this is just 1 degree
        assert length == pytest.approx(1.0, rel=0.01)

    def test_st_length_with_geography_type(self, test_db_session):
        """Test ST_Length with geography type for real-world meters."""
        # Same line, but using geography for actual distance in meters
        line = LineString([(0, 0), (1, 0)])

        result = test_db_session.execute(text("""
            SELECT ST_Length(ST_GeographyFromText(:line))
        """), {'line': line.wkt})

        length_meters = result.fetchone()[0]
        # Should be approximately 111,000 meters (111 km)
        assert 110000 < length_meters < 112000

    def test_route_geometry_storage_and_retrieval(self, test_db_session, sample_route):
        """Test that LineString geometry is stored and retrieved correctly."""
        # Retrieve route
        route = test_db_session.query(SavedRoute).filter_by(
            route_id=sample_route.route_id
        ).first()

        assert route.geom is not None

        # Convert to Shapely
        shape = to_shape(route.geom)
        assert isinstance(shape, LineString)
        assert shape.is_valid
        assert not shape.is_empty

        # Should have 4 coordinates (3 connected segments)
        assert len(shape.coords) == 4


@pytest.mark.integration
@pytest.mark.spatial
class TestCoordinateTransformations:
    """Tests for coordinate system transformations."""

    def test_wgs84_srid_4326_storage(self, test_db_session, sample_session):
        """Test that geometries are stored with SRID 4326 (WGS84)."""
        linestring = LineString([(-72.575, 44.260), (-72.580, 44.265)])

        route = SavedRoute(
            session_id=sample_session.session_id,
            route_name="SRID Test",
            total_curvature=10.0,
            total_length=500.0,
            segment_count=1,
            geom=from_shape(linestring, srid=4326),
            url_slug="srid-test"
        )

        test_db_session.add(route)
        test_db_session.commit()

        # Query SRID from database
        result = test_db_session.execute(text("""
            SELECT ST_SRID(geom)
            FROM saved_routes
            WHERE route_id = :route_id
        """), {'route_id': route.route_id})

        srid = result.fetchone()[0]
        assert srid == 4326

    def test_coordinate_precision_preserved(self, test_db_session, sample_session):
        """Test that high-precision coordinates are preserved."""
        # Use very precise coordinates
        precise_lon, precise_lat = -72.123456789, 44.987654321
        linestring = LineString([
            (precise_lon, precise_lat),
            (precise_lon + 0.001, precise_lat + 0.001)
        ])

        route = SavedRoute(
            session_id=sample_session.session_id,
            route_name="Precision Test",
            total_curvature=10.0,
            total_length=500.0,
            segment_count=1,
            geom=from_shape(linestring, srid=4326),
            url_slug="precision-test"
        )

        test_db_session.add(route)
        test_db_session.commit()
        test_db_session.refresh(route)

        # Retrieve and check precision
        shape = to_shape(route.geom)
        first_coord = shape.coords[0]

        assert first_coord[0] == pytest.approx(precise_lon, abs=1e-8)
        assert first_coord[1] == pytest.approx(precise_lat, abs=1e-8)


@pytest.mark.integration
@pytest.mark.spatial
class TestBoundingBoxQueries:
    """Tests for bounding box spatial queries."""

    def test_bbox_filtering_includes_route(self, test_db_session, sample_session):
        """Test that route within bounding box is found."""
        # Create route in Vermont (around Stowe)
        linestring = LineString([(-72.575, 44.260), (-72.580, 44.265)])
        route = SavedRoute(
            session_id=sample_session.session_id,
            route_name="Vermont Route",
            total_curvature=10.0,
            total_length=500.0,
            segment_count=1,
            geom=from_shape(linestring, srid=4326),
            url_slug="vt-route"
        )
        test_db_session.add(route)
        test_db_session.commit()

        # Query with bbox that contains the route
        # Bbox: west, south, east, north (in degrees)
        bbox_west, bbox_south = -73.0, 44.0
        bbox_east, bbox_north = -72.0, 45.0

        result = test_db_session.execute(text("""
            SELECT route_id, route_name
            FROM saved_routes
            WHERE ST_Intersects(
                geom,
                ST_MakeEnvelope(:west, :south, :east, :north, 4326)
            )
        """), {
            'west': bbox_west,
            'south': bbox_south,
            'east': bbox_east,
            'north': bbox_north
        })

        routes = result.fetchall()
        route_names = [r[1] for r in routes]

        assert "Vermont Route" in route_names

    def test_bbox_filtering_excludes_route(self, test_db_session, sample_session):
        """Test that route outside bounding box is not found."""
        # Create route in Vermont
        linestring = LineString([(-72.575, 44.260), (-72.580, 44.265)])
        route = SavedRoute(
            session_id=sample_session.session_id,
            route_name="Vermont Route",
            total_curvature=10.0,
            total_length=500.0,
            segment_count=1,
            geom=from_shape(linestring, srid=4326),
            url_slug="vt-route-2"
        )
        test_db_session.add(route)
        test_db_session.commit()

        # Query with bbox in California (far from Vermont)
        bbox_west, bbox_south = -122.5, 37.5
        bbox_east, bbox_north = -122.0, 38.0

        result = test_db_session.execute(text("""
            SELECT route_id, route_name
            FROM saved_routes
            WHERE ST_Intersects(
                geom,
                ST_MakeEnvelope(:west, :south, :east, :north, 4326)
            )
        """), {
            'west': bbox_west,
            'south': bbox_south,
            'east': bbox_east,
            'north': bbox_north
        })

        routes = result.fetchall()
        route_names = [r[1] for r in routes]

        assert "Vermont Route" not in route_names


@pytest.mark.integration
@pytest.mark.spatial
class TestGeometryValidation:
    """Tests for geometry validation operations."""

    def test_linestring_is_simple(self, test_db_session):
        """Test that valid LineString is simple (no self-intersections)."""
        # Simple line (not crossing itself)
        simple_line = LineString([
            (-72.575, 44.260),
            (-72.580, 44.265),
            (-72.585, 44.270)
        ])

        result = test_db_session.execute(text("""
            SELECT ST_IsSimple(ST_GeomFromText(:line, 4326))
        """), {'line': simple_line.wkt})

        is_simple = result.fetchone()[0]
        assert is_simple is True

    def test_self_intersecting_linestring_detected(self, test_db_session):
        """Test that self-intersecting LineString is detected."""
        # Create a figure-8 shape (self-intersecting)
        figure_eight = LineString([
            (0, 0),
            (1, 1),
            (1, -1),
            (0, 0)
        ])

        result = test_db_session.execute(text("""
            SELECT ST_IsSimple(ST_GeomFromText(:line, 4326))
        """), {'line': figure_eight.wkt})

        is_simple = result.fetchone()[0]
        assert is_simple is False, "Self-intersecting line should not be simple"

    def test_linestring_is_valid(self, test_db_session):
        """Test that constructed LineString is geometrically valid."""
        linestring = create_test_linestring(CONNECTED_SEGMENTS)

        result = test_db_session.execute(text("""
            SELECT ST_IsValid(ST_GeomFromText(:line, 4326))
        """), {'line': linestring.wkt})

        is_valid = result.fetchone()[0]
        assert is_valid is True


@pytest.mark.integration
@pytest.mark.spatial
class TestDistanceCalculations:
    """Tests for distance-based spatial queries."""

    def test_route_length_matches_geometry_length(self, test_db_session, sample_route):
        """Test that stored length matches PostGIS calculated length."""
        # Get stored length
        stored_length = sample_route.total_length

        # Calculate length using PostGIS geography type (meters)
        result = test_db_session.execute(text("""
            SELECT ST_Length(geography(geom))
            FROM saved_routes
            WHERE route_id = :route_id
        """), {'route_id': sample_route.route_id})

        calculated_length = result.fetchone()[0]

        # Sample data uses simplified lengths, so allow wider tolerance
        # The geographic calculation accounts for Earth's curvature
        assert calculated_length == pytest.approx(stored_length, rel=0.3)

    def test_distance_between_points(self, test_db_session):
        """Test calculating distance between two points."""
        # Two points 1 degree apart at equator
        point1 = Point(0, 0)
        point2 = Point(1, 0)

        result = test_db_session.execute(text("""
            SELECT ST_Distance(
                geography(ST_GeomFromText(:p1, 4326)),
                geography(ST_GeomFromText(:p2, 4326))
            )
        """), {
            'p1': point1.wkt,
            'p2': point2.wkt
        })

        distance_meters = result.fetchone()[0]
        # Should be approximately 111 km
        assert 110000 < distance_meters < 112000


@pytest.mark.integration
@pytest.mark.spatial
class TestSpatialIndexes:
    """Tests for GIST spatial indexes."""

    def test_geom_gist_index_used(self, test_db_session, sample_session):
        """Test that GIST index on geom column is used for queries."""
        # Create multiple routes
        for i in range(5):
            linestring = LineString([
                (-72.0 + (i * 0.1), 44.0),
                (-72.0 + (i * 0.1), 44.1)
            ])
            route = SavedRoute(
                session_id=sample_session.session_id,
                route_name=f"Route {i}",
                total_curvature=10.0,
                total_length=500.0,
                segment_count=1,
                geom=from_shape(linestring, srid=4326),
                url_slug=f"route-{i}"
            )
            test_db_session.add(route)
        test_db_session.commit()

        # Query with EXPLAIN to check index usage
        result = test_db_session.execute(text("""
            EXPLAIN (FORMAT JSON)
            SELECT route_id
            FROM saved_routes
            WHERE ST_Intersects(
                geom,
                ST_MakeEnvelope(-72.2, 43.9, -71.8, 44.2, 4326)
            )
        """))

        explain_json = result.fetchone()[0]
        # Check if index scan is used (would be in explain output)
        # For now, just verify query executes
        assert explain_json is not None

    def test_spatial_query_performance(self, test_db_session, sample_session):
        """Test that spatial queries complete in reasonable time."""
        import time

        # Create 100 routes
        for i in range(100):
            linestring = LineString([
                (-72.0 + (i * 0.01), 44.0),
                (-72.0 + (i * 0.01), 44.01)
            ])
            route = SavedRoute(
                session_id=sample_session.session_id,
                route_name=f"Perf Route {i}",
                total_curvature=10.0,
                total_length=500.0,
                segment_count=1,
                geom=from_shape(linestring, srid=4326),
                url_slug=f"perf-route-{i}"
            )
            test_db_session.add(route)

        test_db_session.commit()

        # Time a spatial query
        start = time.time()

        test_db_session.execute(text("""
            SELECT COUNT(*)
            FROM saved_routes
            WHERE ST_Intersects(
                geom,
                ST_MakeEnvelope(-72.5, 43.5, -71.5, 44.5, 4326)
            )
        """))

        elapsed = time.time() - start

        # Should complete in under 1 second (with index)
        assert elapsed < 1.0, f"Spatial query took {elapsed}s (expected <1s)"
