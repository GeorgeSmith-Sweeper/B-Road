"""
Unit tests for tile coordinate math utilities.

Tests ZXY slippy map tile to WGS84 bounding box conversion.
"""

import pytest
import math

from api.utils.tile_math import tile_to_bbox


class TestTileToBbox:
    """Tests for tile_to_bbox conversion."""

    def test_zoom_0_world_tile(self):
        """Zoom 0 has a single tile covering the whole world."""
        west, south, east, north = tile_to_bbox(0, 0, 0)
        assert west == pytest.approx(-180.0)
        assert east == pytest.approx(180.0)
        assert north == pytest.approx(85.0511, abs=0.01)
        assert south == pytest.approx(-85.0511, abs=0.01)

    def test_zoom_1_top_left(self):
        """Zoom 1, tile (0,0) covers the northwest quadrant."""
        west, south, east, north = tile_to_bbox(1, 0, 0)
        assert west == pytest.approx(-180.0)
        assert east == pytest.approx(0.0)
        assert north == pytest.approx(85.0511, abs=0.01)
        assert south == pytest.approx(0.0, abs=0.01)

    def test_zoom_1_top_right(self):
        """Zoom 1, tile (1,0) covers the northeast quadrant."""
        west, south, east, north = tile_to_bbox(1, 1, 0)
        assert west == pytest.approx(0.0)
        assert east == pytest.approx(180.0)
        assert north == pytest.approx(85.0511, abs=0.01)
        assert south == pytest.approx(0.0, abs=0.01)

    def test_zoom_1_bottom_left(self):
        """Zoom 1, tile (0,1) covers the southwest quadrant."""
        west, south, east, north = tile_to_bbox(1, 0, 1)
        assert west == pytest.approx(-180.0)
        assert east == pytest.approx(0.0)
        assert north == pytest.approx(0.0, abs=0.01)
        assert south == pytest.approx(-85.0511, abs=0.01)

    def test_zoom_1_bottom_right(self):
        """Zoom 1, tile (1,1) covers the southeast quadrant."""
        west, south, east, north = tile_to_bbox(1, 1, 1)
        assert west == pytest.approx(0.0)
        assert east == pytest.approx(180.0)
        assert north == pytest.approx(0.0, abs=0.01)
        assert south == pytest.approx(-85.0511, abs=0.01)

    def test_vermont_area_tile(self):
        """A tile at zoom 8 near Vermont should cover that geographic area."""
        # Tile 8/74/93 covers approximately Vermont area
        west, south, east, north = tile_to_bbox(8, 74, 93)
        # Vermont is roughly -73.5 W, 42.7 S, -71.5 E, 45.0 N
        # This tile should be somewhere in the northeastern US
        assert -80 < west < -70
        assert -80 < east < -70
        assert 40 < south < 50
        assert 40 < north < 50
        assert west < east
        assert south < north

    def test_adjacent_tiles_share_edges(self):
        """Adjacent tiles should share exact edge coordinates."""
        # Horizontal neighbors at zoom 8
        _, _, east_of_left, _ = tile_to_bbox(8, 74, 93)
        west_of_right, _, _, _ = tile_to_bbox(8, 75, 93)
        assert east_of_left == pytest.approx(west_of_right)

        # Vertical neighbors at zoom 8
        _, south_of_top, _, _ = tile_to_bbox(8, 74, 93)
        _, _, _, north_of_bottom = tile_to_bbox(8, 74, 94)
        assert south_of_top == pytest.approx(north_of_bottom)

    def test_bounds_validity_across_zoom_levels(self):
        """At any zoom level, west < east and south < north."""
        for z in range(0, 15):
            max_coord = 2 ** z
            # Test a few tiles at each zoom
            for x in [0, max_coord // 2, max_coord - 1]:
                for y in [0, max_coord // 2, max_coord - 1]:
                    west, south, east, north = tile_to_bbox(z, x, y)
                    assert west < east, f"Failed at z={z}, x={x}, y={y}: west={west} >= east={east}"
                    assert south < north, f"Failed at z={z}, x={x}, y={y}: south={south} >= north={north}"
                    assert -180 <= west <= 180
                    assert -180 <= east <= 180
                    assert -90 <= south <= 90
                    assert -90 <= north <= 90

    def test_higher_zoom_produces_smaller_bbox(self):
        """Higher zoom levels should produce smaller bounding boxes."""
        w0, s0, e0, n0 = tile_to_bbox(4, 4, 5)
        w1, s1, e1, n1 = tile_to_bbox(8, 74, 93)

        width_z4 = e0 - w0
        width_z8 = e1 - w1

        assert width_z4 > width_z8

    def test_tile_at_prime_meridian(self):
        """Tiles spanning the prime meridian should have west < 0 and east > 0 (or both on same side)."""
        # At zoom 2, tile (1,1) should span close to prime meridian
        west, south, east, north = tile_to_bbox(2, 1, 1)
        # This tile spans -90 to 0 longitude
        assert west == pytest.approx(-90.0)
        assert east == pytest.approx(0.0)
