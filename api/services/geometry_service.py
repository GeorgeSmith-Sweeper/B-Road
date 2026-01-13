"""
Service for GeoJSON conversions.
"""

from typing import List, Dict
from curvature.output import OutputTools


class GeometryService:
    """Service for geometry transformations."""

    def __init__(self):
        self.tools = OutputTools('km')

    def collection_to_geojson_feature(self, collection: dict) -> dict:
        """Convert a curvature collection to a GeoJSON Feature"""
        # Build the line coordinates from all segments in all ways
        coords = []

        for way in collection['ways']:
            if 'segments' in way and len(way['segments']) > 0:
                first_segment = way['segments'][0]
                coords.append([first_segment['start'][1], first_segment['start'][0]])

                for segment in way['segments']:
                    coords.append([segment['end'][1], segment['end'][0]])

        # Calculate properties
        curvature = self.tools.get_collection_curvature(collection)
        length = self.tools.get_collection_length(collection)
        name = self.tools.get_collection_name(collection)
        surface = self.tools.get_collection_paved_style(collection)

        # Build GeoJSON Feature
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": coords
            },
            "properties": {
                "name": name,
                "curvature": round(curvature, 2),
                "length_km": round(length / 1000, 2),
                "length_mi": round(length / 1609, 2),
                "surface": surface,
                "join_type": collection.get('join_type', 'none'),
            }
        }

        return feature

    def collections_to_geojson(
        self,
        collections: List[dict],
        metadata: dict = None
    ) -> dict:
        """Convert multiple collections to GeoJSON FeatureCollection"""
        features = []
        for collection in collections:
            try:
                feature = self.collection_to_geojson_feature(collection)
                features.append(feature)
            except Exception:
                # Skip collections that can't be converted
                continue

        geojson = {
            "type": "FeatureCollection",
            "features": features
        }

        if metadata:
            geojson["metadata"] = metadata

        return geojson

    def segments_to_geojson(self, segments: List[dict]) -> dict:
        """Convert segment data to GeoJSON FeatureCollection"""
        features = []
        for seg in segments:
            feature = {
                "type": "Feature",
                "id": f"{seg['way_id']}-{seg['segment_index']}",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [seg['start'][1], seg['start'][0]],
                        [seg['end'][1], seg['end'][0]]
                    ]
                },
                "properties": seg
            }
            features.append(feature)

        return {
            "type": "FeatureCollection",
            "features": features
        }
