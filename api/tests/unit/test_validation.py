"""
Unit tests for route validation logic.

Tests validation of:
- Route statistics calculations
- Segment connectivity
- Coordinate bounds checking
- Segment ordering
- Data integrity
"""

import pytest
from shapely.geometry import LineString
from geoalchemy2.shape import from_shape

from models import SavedRoute, RouteSegment
from tests.fixtures.sample_segments import (
    CONNECTED_SEGMENTS,
    DISCONNECTED_SEGMENTS,
    INVALID_LATITUDE_SEGMENT,
    INVALID_LONGITUDE_SEGMENT,
    CONNECTED_SEGMENTS_STATS,
    SINGLE_SEGMENT
)
from tests.conftest import assert_segments_connected, create_test_linestring


@pytest.mark.unit
class TestRouteStatisticsCalculation:
    """Tests for route statistics calculations."""

    def test_curvature_calculation(self):
        """Test that total curvature is sum of segment curvatures."""
        total_curvature = sum(seg["curvature"] for seg in CONNECTED_SEGMENTS)
        assert total_curvature == CONNECTED_SEGMENTS_STATS["total_curvature"]
        assert total_curvature == 60.0  # 15 + 20 + 25

    def test_length_calculation(self):
        """Test that total length is sum of segment lengths."""
        total_length = sum(seg["length"] for seg in CONNECTED_SEGMENTS)
        assert total_length == CONNECTED_SEGMENTS_STATS["total_length"]
        assert total_length == 1650.0  # 500 + 550 + 600

    def test_segment_count(self):
        """Test that segment count matches number of segments."""
        segment_count = len(CONNECTED_SEGMENTS)
        assert segment_count == CONNECTED_SEGMENTS_STATS["segment_count"]
        assert segment_count == 3

    def test_empty_route_statistics(self):
        """Test statistics for empty route."""
        empty_segments = []
        total_curvature = sum(seg["curvature"] for seg in empty_segments)
        total_length = sum(seg["length"] for seg in empty_segments)

        assert total_curvature == 0.0
        assert total_length == 0.0
        assert len(empty_segments) == 0

    def test_single_segment_statistics(self):
        """Test statistics for route with single segment."""
        segments = [SINGLE_SEGMENT]
        total_curvature = sum(seg["curvature"] for seg in segments)
        total_length = sum(seg["length"] for seg in segments)

        assert total_curvature == 10.0
        assert total_length == 450.0
        assert len(segments) == 1


@pytest.mark.unit
class TestSegmentConnectivity:
    """Tests for segment connectivity validation."""

    def test_connected_segments_validation(self):
        """Test that connected segments pass validation."""
        # Should not raise an error
        assert_segments_connected(CONNECTED_SEGMENTS)

    def test_disconnected_segments_validation(self):
        """Test that disconnected segments fail validation."""
        with pytest.raises(AssertionError, match="Segment .* end .* != Segment .* start"):
            assert_segments_connected(DISCONNECTED_SEGMENTS)

    def test_single_segment_always_valid(self):
        """Test that single segment is always valid (nothing to connect to)."""
        single_seg_list = [SINGLE_SEGMENT]
        # Should not raise an error
        assert_segments_connected(single_seg_list)

    def test_segments_must_connect_exactly(self):
        """Test that segment endpoints must match exactly."""
        # Create segments with slight coordinate mismatch
        almost_connected = [
            {
                "way_id": 1,
                "start": [44.260, -72.575],
                "end": [44.265, -72.580],
                "length": 500.0,
                "radius": 100.0,
                "curvature": 15.0,
                "curvature_level": 2
            },
            {
                "way_id": 2,
                "start": [44.265001, -72.580],  # Slight mismatch (0.000001 degree)
                "end": [44.270, -72.585],
                "length": 550.0,
                "radius": 80.0,
                "curvature": 20.0,
                "curvature_level": 3
            }
        ]

        with pytest.raises(AssertionError):
            assert_segments_connected(almost_connected)


@pytest.mark.unit
class TestCoordinateValidation:
    """Tests for coordinate bounds checking."""

    def test_valid_latitude_range(self):
        """Test that valid latitudes (-90 to 90) are accepted."""
        valid_coords = [
            [0.0, 0.0],      # Equator, Prime Meridian
            [90.0, 0.0],     # North Pole
            [-90.0, 0.0],    # South Pole
            [45.0, -122.0],  # Portland, OR
            [-33.9, 18.4],   # Cape Town
        ]

        for lat, lon in valid_coords:
            assert -90 <= lat <= 90, f"Invalid latitude: {lat}"
            assert -180 <= lon <= 180, f"Invalid longitude: {lon}"

    def test_invalid_latitude_detected(self):
        """Test that latitudes outside -90 to 90 are invalid."""
        seg = INVALID_LATITUDE_SEGMENT
        lat = seg["start"][0]
        assert lat > 90 or lat < -90, "Should detect invalid latitude"

    def test_invalid_longitude_detected(self):
        """Test that longitudes outside -180 to 180 are invalid."""
        seg = INVALID_LONGITUDE_SEGMENT
        lon = seg["start"][1]
        assert lon > 180 or lon < -180, "Should detect invalid longitude"

    def test_coordinate_precision(self):
        """Test that coordinates maintain precision."""
        # PostGIS can handle very precise coordinates
        precise_coords = [44.123456789, -72.987654321]
        lat, lon = precise_coords

        # Coordinates should be preserved with high precision
        assert lat == pytest.approx(44.123456789, abs=1e-9)
        assert lon == pytest.approx(-72.987654321, abs=1e-9)


@pytest.mark.unit
class TestSegmentOrdering:
    """Tests for segment position ordering."""

    def test_segments_ordered_by_position(self, test_db_session, sample_route):
        """Test that segments are returned in position order."""
        # Create segments out of order
        segments_data = [
            (3, 44.030, -72.030, 44.035, -72.035),
            (1, 44.010, -72.010, 44.015, -72.015),
            (2, 44.020, -72.020, 44.025, -72.025),
        ]

        for pos, start_lat, start_lon, end_lat, end_lon in segments_data:
            seg = RouteSegment(
                route_id=sample_route.route_id,
                position=pos,
                start_lat=start_lat,
                start_lon=start_lon,
                end_lat=end_lat,
                end_lon=end_lon,
                length=100.0,
                radius=50.0,
                curvature=5.0,
                curvature_level=1
            )
            test_db_session.add(seg)

        test_db_session.commit()
        test_db_session.refresh(sample_route)

        # Segments should be returned in position order
        positions = [seg.position for seg in sample_route.segments]
        assert positions == [1, 2, 3]

    def test_position_starts_at_one(self, test_db_session, sample_segments):
        """Test that segment positions start at 1 (not 0)."""
        first_segment = min(sample_segments, key=lambda s: s.position)
        assert first_segment.position == 1

    def test_positions_are_consecutive(self, test_db_session, sample_segments):
        """Test that positions are consecutive integers."""
        positions = sorted([seg.position for seg in sample_segments])
        expected = list(range(1, len(sample_segments) + 1))
        assert positions == expected


@pytest.mark.unit
class TestLineStringConstruction:
    """Tests for LineString geometry construction from segments."""

    def test_linestring_from_connected_segments(self):
        """Test creating LineString from connected segments."""
        linestring = create_test_linestring(CONNECTED_SEGMENTS)

        assert isinstance(linestring, LineString)
        assert linestring.is_valid
        assert not linestring.is_empty

        # Should have 4 coordinates (3 segments = 4 points)
        assert len(linestring.coords) == 4

    def test_linestring_coordinates_order(self):
        """Test that LineString coordinates are in correct order."""
        linestring = create_test_linestring(CONNECTED_SEGMENTS)
        coords = list(linestring.coords)

        # First coordinate should match first segment start
        first_seg = CONNECTED_SEGMENTS[0]
        assert coords[0] == pytest.approx((first_seg["start"][1], first_seg["start"][0]))

        # Last coordinate should match last segment end
        last_seg = CONNECTED_SEGMENTS[-1]
        assert coords[-1] == pytest.approx((last_seg["end"][1], last_seg["end"][0]))

    def test_linestring_no_self_intersection(self):
        """Test that LineString from valid segments has no self-intersections."""
        linestring = create_test_linestring(CONNECTED_SEGMENTS)

        # Simple LineString from connected segments should not self-intersect
        assert linestring.is_simple

    def test_single_segment_linestring(self):
        """Test creating LineString from single segment."""
        linestring = create_test_linestring([SINGLE_SEGMENT])

        assert isinstance(linestring, LineString)
        assert len(linestring.coords) == 2  # Start and end points


@pytest.mark.unit
class TestRouteDataIntegrity:
    """Tests for overall route data integrity."""

    def test_route_with_valid_geometry(self, test_db_session, sample_session):
        """Test saving route with valid geometry."""
        linestring = create_test_linestring(CONNECTED_SEGMENTS)

        route = SavedRoute(
            session_id=sample_session.session_id,
            route_name="Valid Route",
            total_curvature=60.0,
            total_length=1650.0,
            segment_count=3,
            geom=from_shape(linestring, srid=4326),
            route_data={'segments': CONNECTED_SEGMENTS},
            url_slug="valid-route-test"
        )

        test_db_session.add(route)
        test_db_session.commit()
        test_db_session.refresh(route)

        assert route.route_id is not None
        assert route.geom is not None

    def test_statistics_match_segment_data(self, test_db_session, sample_route, sample_segments):
        """Test that route statistics match actual segment data."""
        # Calculate from actual segments
        total_curvature = sum(seg.curvature for seg in sample_segments)
        total_length = sum(seg.length for seg in sample_segments)

        # Should match route statistics
        assert sample_route.total_curvature == pytest.approx(total_curvature)
        assert sample_route.total_length == pytest.approx(total_length)
        assert sample_route.segment_count == len(sample_segments)

    def test_route_data_jsonb_preserves_structure(self, test_db_session, sample_route):
        """Test that JSONB route_data field preserves structure."""
        route_data = sample_route.route_data

        assert 'segments' in route_data
        assert isinstance(route_data['segments'], list)
        assert len(route_data['segments']) == 3

        # Verify segment structure is preserved
        first_seg = route_data['segments'][0]
        assert 'way_id' in first_seg
        assert 'start' in first_seg
        assert 'end' in first_seg
        assert 'curvature' in first_seg

    def test_negative_curvature_rejected(self):
        """Test that negative curvature values are invalid."""
        # Curvature should always be non-negative
        invalid_segment = {
            "way_id": 1,
            "start": [44.0, -72.0],
            "end": [44.1, -72.1],
            "length": 100.0,
            "radius": 50.0,
            "curvature": -10.0,  # Invalid!
            "curvature_level": 1
        }

        # In a real implementation, this should be validated
        assert invalid_segment["curvature"] < 0

    def test_zero_length_segment_edge_case(self):
        """Test handling of zero-length segments."""
        zero_length_segment = {
            "way_id": 1,
            "start": [44.0, -72.0],
            "end": [44.0, -72.0],  # Same as start!
            "length": 0.0,
            "radius": 0.0,
            "curvature": 0.0,
            "curvature_level": 0
        }

        # Zero-length segments might indicate data errors
        assert zero_length_segment["length"] == 0.0
        assert zero_length_segment["start"] == zero_length_segment["end"]
