"""
Sample test data for route segments and routes.

Provides realistic test data based on Vermont mountain roads.
"""

# Connected segments forming a valid route
CONNECTED_SEGMENTS = [
    {
        "way_id": 12345,
        "start": [44.260, -72.575],  # Stowe, VT area
        "end": [44.265, -72.580],
        "length": 500.0,
        "radius": 100.0,
        "curvature": 15.0,
        "curvature_level": 2,
        "name": "Mountain Road",
        "highway": "tertiary",
        "surface": "paved",
    },
    {
        "way_id": 12345,
        "start": [44.265, -72.580],  # Connects to previous end
        "end": [44.270, -72.585],
        "length": 550.0,
        "radius": 80.0,
        "curvature": 20.0,
        "curvature_level": 3,
        "name": "Mountain Road",
        "highway": "tertiary",
        "surface": "paved",
    },
    {
        "way_id": 12346,
        "start": [44.270, -72.585],  # Connects to previous end
        "end": [44.275, -72.590],
        "length": 600.0,
        "radius": 60.0,
        "curvature": 25.0,
        "curvature_level": 3,
        "name": "Mountain Road",
        "highway": "tertiary",
        "surface": "paved",
    },
]

# Disconnected segments (for validation testing)
DISCONNECTED_SEGMENTS = [
    {
        "way_id": 12345,
        "start": [44.260, -72.575],
        "end": [44.265, -72.580],
        "length": 500.0,
        "radius": 100.0,
        "curvature": 15.0,
        "curvature_level": 2,
        "name": "Mountain Road",
        "highway": "tertiary",
        "surface": "paved",
    },
    {
        "way_id": 12346,
        "start": [44.300, -72.600],  # DISCONNECTED - different location
        "end": [44.305, -72.605],
        "length": 550.0,
        "radius": 80.0,
        "curvature": 20.0,
        "curvature_level": 3,
        "name": "Other Road",
        "highway": "tertiary",
        "surface": "paved",
    },
]

# Single segment for simple tests
SINGLE_SEGMENT = {
    "way_id": 99999,
    "start": [44.500, -73.200],  # Burlington area
    "end": [44.505, -73.205],
    "length": 450.0,
    "radius": 120.0,
    "curvature": 10.0,
    "curvature_level": 1,
    "name": "Test Road",
    "highway": "secondary",
    "surface": "paved",
}

# Route with many segments (for performance testing)
LONG_ROUTE_SEGMENTS = []
base_lat, base_lon = 44.0, -72.0
for i in range(100):
    LONG_ROUTE_SEGMENTS.append(
        {
            "way_id": 50000 + (i // 10),
            "start": [base_lat + (i * 0.001), base_lon + (i * 0.001)],
            "end": [base_lat + ((i + 1) * 0.001), base_lon + ((i + 1) * 0.001)],
            "length": 100.0 + (i % 20),
            "radius": 50.0 + (i % 50),
            "curvature": 5.0 + (i % 15),
            "curvature_level": (i % 4) + 1,
            "name": f"Route Section {i // 10}",
            "highway": "tertiary",
            "surface": "paved" if i % 3 == 0 else "unpaved",
        }
    )

# Invalid segments (for error testing)
INVALID_LATITUDE_SEGMENT = {
    "way_id": 88888,
    "start": [91.0, -72.575],  # Invalid latitude > 90
    "end": [44.265, -72.580],
    "length": 500.0,
    "radius": 100.0,
    "curvature": 15.0,
    "curvature_level": 2,
    "name": "Invalid Road",
    "highway": "tertiary",
    "surface": "paved",
}

INVALID_LONGITUDE_SEGMENT = {
    "way_id": 88889,
    "start": [44.260, -185.0],  # Invalid longitude < -180
    "end": [44.265, -72.580],
    "length": 500.0,
    "radius": 100.0,
    "curvature": 15.0,
    "curvature_level": 2,
    "name": "Invalid Road",
    "highway": "tertiary",
    "surface": "paved",
}

# Sample route metadata
SAMPLE_ROUTE_METADATA = {
    "route_name": "Test Mountain Loop",
    "description": "A scenic route through the Green Mountains",
    "is_public": False,
}

SAMPLE_PUBLIC_ROUTE_METADATA = {
    "route_name": "Public Scenic Route",
    "description": "Popular twisty road route",
    "is_public": True,
}

# Expected statistics for CONNECTED_SEGMENTS
CONNECTED_SEGMENTS_STATS = {
    "total_curvature": 60.0,  # 15 + 20 + 25
    "total_length": 1650.0,  # 500 + 550 + 600
    "segment_count": 3,
}
