"""
Service for loading and filtering curvature data.

Handles msgpack file loading and filtering collections by criteria.
"""

from typing import List, Optional, Dict
import os
import msgpack

from curvature.output import OutputTools


class DataService:
    """Service for curvature data operations."""

    def __init__(self):
        self.tools = OutputTools("km")
        self.road_collections: List[dict] = []
        self.data_loaded = False

    def load_msgpack_file(self, filepath: str) -> Dict:
        """Load a curvature msgpack file"""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Data file not found: {filepath}")

        collections = []
        with open(filepath, "rb") as f:
            unpacker = msgpack.Unpacker(
                f, use_list=True, raw=False, strict_map_key=False
            )
            for collection in unpacker:
                collections.append(collection)

        self.road_collections = collections
        self.data_loaded = True

        return {
            "status": "success",
            "message": f"Loaded {len(collections)} road collections",
            "filepath": filepath,
        }

    def get_filtered_collections(
        self,
        min_curvature: float = 300,
        max_curvature: Optional[float] = None,
        surface: Optional[str] = None,
        limit: int = 100,
    ) -> List[dict]:
        """Filter road collections by criteria"""
        if not self.data_loaded:
            raise ValueError("No data loaded")

        filtered = []
        for collection in self.road_collections:
            curvature = self.tools.get_collection_curvature(collection)

            if curvature < min_curvature:
                continue
            if max_curvature and curvature > max_curvature:
                continue
            if surface:
                collection_surface = self.tools.get_collection_paved_style(collection)
                if collection_surface != surface:
                    continue

            filtered.append(collection)

            if len(filtered) >= limit:
                break

        return filtered

    def get_segments(
        self, min_curvature: float = 300, bbox: Optional[str] = None, limit: int = 500
    ) -> List[dict]:
        """Get individual road segments for stitching"""
        if not self.data_loaded:
            raise ValueError("No data loaded")

        segments_list = []

        for collection in self.road_collections:
            collection_curvature = self.tools.get_collection_curvature(collection)
            if collection_curvature < min_curvature:
                continue

            for way in collection["ways"]:
                if "segments" not in way:
                    continue

                for seg_idx, segment in enumerate(way["segments"]):
                    # Check bounding box if provided
                    if bbox:
                        try:
                            min_lon, min_lat, max_lon, max_lat = map(
                                float, bbox.split(",")
                            )
                            seg_lat = segment["start"][0]
                            seg_lon = segment["start"][1]
                            if not (
                                min_lon <= seg_lon <= max_lon
                                and min_lat <= seg_lat <= max_lat
                            ):
                                continue
                        except (ValueError, IndexError):
                            pass

                    segment_data = {
                        "way_id": way["id"],
                        "segment_index": seg_idx,
                        "start": segment["start"],
                        "end": segment["end"],
                        "length": segment.get("length", 0),
                        "radius": segment.get("radius", 0),
                        "curvature": segment.get("curvature", 0),
                        "curvature_level": segment.get("curvature_level", 0),
                        "name": way["tags"].get("name", ""),
                        "highway": way["tags"].get("highway", ""),
                        "surface": way["tags"].get("surface", "unknown"),
                    }
                    segments_list.append(segment_data)

                    if len(segments_list) >= limit:
                        break
                if len(segments_list) >= limit:
                    break
            if len(segments_list) >= limit:
                break

        return segments_list
