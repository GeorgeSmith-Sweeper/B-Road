"""
Slippy map tile coordinate math.

Converts ZXY tile coordinates to WGS84 bounding boxes for use in PostGIS
spatial queries. Follows the OpenStreetMap slippy map tile naming convention.

Reference: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
"""

import math
from typing import Tuple


def tile_to_bbox(z: int, x: int, y: int) -> Tuple[float, float, float, float]:
    """
    Convert ZXY slippy map tile coordinates to a WGS84 bounding box.

    Args:
        z: Zoom level (0-22)
        x: Tile column
        y: Tile row

    Returns:
        Tuple of (west, south, east, north) in WGS84 degrees
    """
    n = 2 ** z
    west = x / n * 360.0 - 180.0
    east = (x + 1) / n * 360.0 - 180.0
    north = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    south = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return (west, south, east, north)
