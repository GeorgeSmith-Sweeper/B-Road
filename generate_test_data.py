#!/usr/bin/env python3
"""
Generate realistic test curvature data with actual curved road geometries.
"""

import msgpack
import math

def generate_curved_road(name, base_lat, base_lon, num_points=50, curvature_score=800):
    """Generate a sinuous road with realistic curve geometry."""
    segments = []

    # Generate a winding road path
    for i in range(num_points):
        t = i / num_points

        # Create a winding pattern using sine waves
        lat = base_lat + (t * 0.02) + math.sin(t * math.pi * 4) * 0.002
        lon = base_lon + (t * 0.03) + math.cos(t * math.pi * 3) * 0.003

        next_t = (i + 1) / num_points
        next_lat = base_lat + (next_t * 0.02) + math.sin(next_t * math.pi * 4) * 0.002
        next_lon = base_lon + (next_t * 0.03) + math.cos(next_t * math.pi * 3) * 0.003

        # Calculate segment properties
        seg_length = 50 + (i % 3) * 10  # 50-70m segments
        seg_curvature = curvature_score / num_points + (math.sin(t * 10) * 5)

        segments.append({
            'start': [lat, lon],
            'end': [next_lat, next_lon],
            'length': seg_length,
            'radius': 100 + (i % 5) * 20,
            'curvature': max(0, seg_curvature),
            'curvature_level': min(4, int(seg_curvature / 5))
        })

    return {
        'join_type': 'name',
        'ways': [{
            'id': hash(name) % 1000000,
            'tags': {
                'name': name,
                'highway': 'secondary',
                'surface': 'asphalt'
            },
            'segments': segments
        }]
    }


def generate_mountain_pass(name, base_lat, base_lon, num_points=80, curvature_score=1500):
    """Generate a mountain switchback road."""
    segments = []

    for i in range(num_points):
        t = i / num_points

        # Switchback pattern - zig-zag going up
        switchback = (i // 10) % 2
        lat = base_lat + (t * 0.015)
        lon = base_lon + (0.001 if switchback else -0.001) + math.sin(t * 20) * 0.0008

        next_t = (i + 1) / num_points
        next_switchback = ((i + 1) // 10) % 2
        next_lat = base_lat + (next_t * 0.015)
        next_lon = base_lon + (0.001 if next_switchback else -0.001) + math.sin(next_t * 20) * 0.0008

        seg_length = 40 + (i % 4) * 10
        seg_curvature = curvature_score / num_points + abs(math.sin(t * 15)) * 10

        segments.append({
            'start': [lat, lon],
            'end': [next_lat, next_lon],
            'length': seg_length,
            'radius': 50 + (i % 8) * 15,
            'curvature': max(0, seg_curvature),
            'curvature_level': min(4, int(seg_curvature / 8))
        })

    return {
        'join_type': 'name',
        'ways': [{
            'id': hash(name) % 1000000,
            'tags': {
                'name': name,
                'highway': 'tertiary',
                'surface': 'asphalt'
            },
            'segments': segments
        }]
    }


def generate_gentle_curves(name, base_lat, base_lon, num_points=40, curvature_score=400):
    """Generate a road with gentle flowing curves."""
    segments = []

    for i in range(num_points):
        t = i / num_points

        # Gentle S-curves
        lat = base_lat + (t * 0.025)
        lon = base_lon + math.sin(t * math.pi * 2) * 0.004

        next_t = (i + 1) / num_points
        next_lat = base_lat + (next_t * 0.025)
        next_lon = base_lon + math.sin(next_t * math.pi * 2) * 0.004

        seg_length = 80 + (i % 3) * 20
        seg_curvature = curvature_score / num_points + math.sin(t * 8) * 3

        segments.append({
            'start': [lat, lon],
            'end': [next_lat, next_lon],
            'length': seg_length,
            'radius': 200 + (i % 4) * 50,
            'curvature': max(0, seg_curvature),
            'curvature_level': min(4, int(seg_curvature / 4))
        })

    return {
        'join_type': 'name',
        'ways': [{
            'id': hash(name) % 1000000,
            'tags': {
                'name': name,
                'highway': 'primary',
                'surface': 'asphalt'
            },
            'segments': segments
        }]
    }


def main():
    collections = [
        # Vermont area roads
        generate_curved_road("Smugglers Notch Road", 44.55, -72.79, num_points=60, curvature_score=1200),
        generate_mountain_pass("Mount Mansfield Toll Road", 44.52, -72.82, num_points=70, curvature_score=1800),
        generate_gentle_curves("Route 100 Scenic", 44.30, -72.75, num_points=50, curvature_score=500),
        generate_curved_road("Lincoln Gap Road", 44.10, -72.95, num_points=55, curvature_score=950),
        generate_mountain_pass("Appalachian Gap", 44.15, -72.90, num_points=65, curvature_score=1400),
        generate_gentle_curves("Mad River Valley Road", 44.20, -72.85, num_points=45, curvature_score=450),
        generate_curved_road("Middlebury Gap", 43.95, -72.98, num_points=50, curvature_score=750),
        generate_mountain_pass("Brandon Gap", 43.85, -72.93, num_points=60, curvature_score=1100),

        # Some more varied roads
        generate_curved_road("Granville Gulf Road", 44.00, -72.80, num_points=45, curvature_score=680),
        generate_gentle_curves("Champlain Valley Scenic", 44.40, -73.10, num_points=35, curvature_score=350),
    ]

    # Write to msgpack
    output_path = '/Users/georgesmith-sweeper/Documents/Programming/B-Road/vermont-sample.msgpack'
    with open(output_path, 'wb') as f:
        for collection in collections:
            f.write(msgpack.packb(collection, use_bin_type=True))

    print(f"Generated {len(collections)} road collections to {output_path}")

    # Print summary
    for c in collections:
        name = c['ways'][0]['tags']['name']
        num_segs = len(c['ways'][0]['segments'])
        total_curv = sum(s['curvature'] for s in c['ways'][0]['segments'])
        print(f"  - {name}: {num_segs} segments, curvature: {total_curv:.0f}")


if __name__ == '__main__':
    main()
