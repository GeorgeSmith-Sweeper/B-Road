"""
Sample test data for curvature_segments table.

Provides realistic test data based on Vermont mountain roads for testing
the curvature API endpoints.
"""

import json

# Sample source data (states)
SAMPLE_SOURCES = [
    {"id": 1, "source": "vermont"},
    {"id": 2, "source": "rhode-island"},
    {"id": 3, "source": "delaware"},
]

# Sample curvature segments in Vermont
# Geometry is in SRID 900913 (Web Mercator) as stored in the database
# These are approximate coordinates transformed from WGS84

VERMONT_SEGMENTS = [
    {
        "id": 1,
        "id_hash": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
        "name": "Mountain Road",
        "curvature": 2500,
        "length": 15000,  # meters
        "paved": True,
        "fk_source": 1,
        # GeoJSON for a curvy road segment (WGS84 for testing)
        "geometry_4326": {
            "type": "LineString",
            "coordinates": [
                [-72.580, 44.260],
                [-72.585, 44.262],
                [-72.590, 44.265],
                [-72.595, 44.270],
                [-72.600, 44.275],
            ],
        },
    },
    {
        "id": 2,
        "id_hash": "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1",
        "name": "Gap Road",
        "curvature": 1800,
        "length": 12000,
        "paved": True,
        "fk_source": 1,
        "geometry_4326": {
            "type": "LineString",
            "coordinates": [
                [-72.700, 44.100],
                [-72.705, 44.105],
                [-72.710, 44.110],
                [-72.715, 44.115],
            ],
        },
    },
    {
        "id": 3,
        "id_hash": "c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1b2",
        "name": "Lincoln Gap Road",
        "curvature": 3200,
        "length": 18000,
        "paved": True,
        "fk_source": 1,
        "geometry_4326": {
            "type": "LineString",
            "coordinates": [
                [-72.900, 44.050],
                [-72.905, 44.055],
                [-72.910, 44.060],
                [-72.915, 44.065],
                [-72.920, 44.070],
            ],
        },
    },
    {
        "id": 4,
        "id_hash": "d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1b2c3",
        "name": "Smugglers Notch Road",
        "curvature": 4500,
        "length": 20000,
        "paved": True,
        "fk_source": 1,
        "geometry_4326": {
            "type": "LineString",
            "coordinates": [
                [-72.775, 44.535],
                [-72.780, 44.540],
                [-72.785, 44.545],
                [-72.790, 44.550],
                [-72.795, 44.555],
            ],
        },
    },
    {
        "id": 5,
        "id_hash": "e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1b2c3d4",
        "name": "Mild Country Road",
        "curvature": 400,
        "length": 5000,
        "paved": True,
        "fk_source": 1,
        "geometry_4326": {
            "type": "LineString",
            "coordinates": [
                [-73.200, 44.450],
                [-73.205, 44.455],
            ],
        },
    },
]

# Rhode Island segments (for multi-source testing)
RHODE_ISLAND_SEGMENTS = [
    {
        "id": 6,
        "id_hash": "f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1b2c3d4e5",
        "name": "Ocean Drive",
        "curvature": 850,
        "length": 8000,
        "paved": True,
        "fk_source": 2,
        "geometry_4326": {
            "type": "LineString",
            "coordinates": [
                [-71.350, 41.470],
                [-71.355, 41.475],
                [-71.360, 41.480],
            ],
        },
    },
    {
        "id": 7,
        "id_hash": "g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1b2c3d4e5f6",
        "name": "Gravel Path",
        "curvature": 600,
        "length": 3000,
        "paved": False,
        "fk_source": 2,
        "geometry_4326": {
            "type": "LineString",
            "coordinates": [
                [-71.500, 41.600],
                [-71.505, 41.605],
            ],
        },
    },
]

# Delaware segments
DELAWARE_SEGMENTS = [
    {
        "id": 8,
        "id_hash": "h8i9j0k1l2m3n4o5p6q7r8s9t0a1b2c3d4e5f6g7",
        "name": "Coastal Highway",
        "curvature": 250,
        "length": 10000,
        "paved": True,
        "fk_source": 3,
        "geometry_4326": {
            "type": "LineString",
            "coordinates": [
                [-75.500, 38.800],
                [-75.505, 38.805],
                [-75.510, 38.810],
            ],
        },
    },
]

# Combined for convenience
ALL_SEGMENTS = VERMONT_SEGMENTS + RHODE_ISLAND_SEGMENTS + DELAWARE_SEGMENTS

# Sample segment ways (for detail queries)
SAMPLE_SEGMENT_WAYS = [
    {
        "fk_segment": 1,
        "position": 0,
        "id": 100001,  # OSM way ID
        "name": "Mountain Road",
        "fk_highway": 1,  # tertiary
        "fk_surface": 1,  # paved
        "curvature": 1200,
        "length": 7000,
        "min_lon": -72.590,
        "max_lon": -72.580,
        "min_lat": 44.260,
        "max_lat": 44.270,
    },
    {
        "fk_segment": 1,
        "position": 1,
        "id": 100002,
        "name": "Mountain Road",
        "fk_highway": 1,
        "fk_surface": 1,
        "curvature": 1300,
        "length": 8000,
        "min_lon": -72.600,
        "max_lon": -72.590,
        "min_lat": 44.270,
        "max_lat": 44.275,
    },
]

# Sample tags (for joins)
SAMPLE_TAGS = [
    {"tag_id": 1, "tag_name": "highway", "tag_value": "tertiary"},
    {"tag_id": 2, "tag_name": "highway", "tag_value": "secondary"},
    {"tag_id": 3, "tag_name": "surface", "tag_value": "asphalt"},
    {"tag_id": 4, "tag_name": "surface", "tag_value": "gravel"},
]

# Test bounding boxes
VERMONT_BBOX = {
    "west": -73.5,
    "south": 42.7,
    "east": -71.5,
    "north": 45.0,
}

RHODE_ISLAND_BBOX = {
    "west": -71.9,
    "south": 41.1,
    "east": -71.1,
    "north": 42.0,
}

EMPTY_BBOX = {
    "west": 0.0,
    "south": 0.0,
    "east": 1.0,
    "north": 1.0,
}

# Expected results
EXPECTED_VERMONT_HIGH_CURVATURE = [
    # Segments with curvature >= 1000, ordered by curvature DESC
    {"id": 4, "name": "Smugglers Notch Road", "curvature": 4500},
    {"id": 3, "name": "Lincoln Gap Road", "curvature": 3200},
    {"id": 1, "name": "Mountain Road", "curvature": 2500},
    {"id": 2, "name": "Gap Road", "curvature": 1800},
]

EXPECTED_SOURCE_COUNTS = [
    {"name": "delaware", "segment_count": 1},
    {"name": "rhode-island", "segment_count": 2},
    {"name": "vermont", "segment_count": 5},
]


def make_geojson_feature(segment: dict) -> dict:
    """Convert a segment dict to a GeoJSON Feature."""
    return {
        "type": "Feature",
        "id": str(segment["id"]),
        "geometry": segment["geometry_4326"],
        "properties": {
            "id": segment["id"],
            "id_hash": segment["id_hash"],
            "name": segment["name"],
            "curvature": segment["curvature"],
            "curvature_level": get_curvature_level(segment["curvature"]),
            "length": segment["length"],
            "length_km": round(segment["length"] / 1000, 2),
            "length_mi": round(segment["length"] / 1609, 2),
            "paved": segment["paved"],
            "surface": "paved" if segment["paved"] else "unpaved",
            "source": SAMPLE_SOURCES[segment["fk_source"] - 1]["source"],
        },
    }


def get_curvature_level(curvature: int) -> str:
    """Get curvature level string from numeric value."""
    if curvature < 600:
        return "mild"
    if curvature < 1000:
        return "moderate"
    if curvature < 2000:
        return "curvy"
    return "extreme"


def make_feature_collection(segments: list) -> dict:
    """Convert a list of segments to a GeoJSON FeatureCollection."""
    return {
        "type": "FeatureCollection",
        "features": [make_geojson_feature(s) for s in segments],
        "metadata": {"count": len(segments)},
    }
