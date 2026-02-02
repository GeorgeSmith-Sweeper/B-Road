"""
Service for curvature segment operations.

Handles business logic for querying curvature data and building GeoJSON responses.
"""

from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List
import json
import logging

from api.repositories.curvature_repository import CurvatureRepository

logger = logging.getLogger(__name__)


class CurvatureService:
    """Service for curvature segment operations."""

    def __init__(self, db: Session):
        self.db = db
        self.curvature_repo = CurvatureRepository(db)

    def get_segments_geojson(
        self,
        west: float,
        south: float,
        east: float,
        north: float,
        min_curvature: int = 300,
        limit: int = 1000,
        source: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get curvature segments as GeoJSON FeatureCollection.

        Args:
            west: Western longitude boundary
            south: Southern latitude boundary
            east: Eastern longitude boundary
            north: Northern latitude boundary
            min_curvature: Minimum curvature score (default 300)
            limit: Maximum number of segments to return (default 1000)
            source: Optional source name to filter by

        Returns:
            GeoJSON FeatureCollection with segment features
        """
        segments = self.curvature_repo.get_segments_in_bbox(
            west=west,
            south=south,
            east=east,
            north=north,
            min_curvature=min_curvature,
            limit=limit,
            source=source,
        )

        return self._build_feature_collection(segments)

    def get_segments_by_source_geojson(
        self,
        source_name: str,
        min_curvature: int = 300,
        limit: int = 1000,
    ) -> Dict[str, Any]:
        """
        Get curvature segments for a source as GeoJSON.

        Args:
            source_name: Name of the source (e.g., "vermont")
            min_curvature: Minimum curvature score
            limit: Maximum number of segments to return

        Returns:
            GeoJSON FeatureCollection with segment features
        """
        segments = self.curvature_repo.get_segments_by_source(
            source_name=source_name,
            min_curvature=min_curvature,
            limit=limit,
        )

        return self._build_feature_collection(segments)

    def list_sources(self) -> List[Dict[str, Any]]:
        """
        List all available data sources with segment counts.

        Returns:
            List of source info dictionaries
        """
        return self.curvature_repo.list_sources()

    def get_segment_detail(self, segment_id: int) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a single segment including its ways.

        Args:
            segment_id: The segment ID

        Returns:
            Segment detail dictionary or None if not found
        """
        segment = self.curvature_repo.get_segment_with_ways(segment_id)

        if not segment:
            return None

        # Parse the geometry JSON string
        geometry = json.loads(segment["geometry"]) if segment["geometry"] else None

        return {
            "id": segment["id"],
            "id_hash": segment["id_hash"],
            "name": segment["name"],
            "curvature": segment["curvature"],
            "length": segment["length"],
            "length_km": round(segment["length"] / 1000, 2) if segment["length"] else 0,
            "length_mi": round(segment["length"] / 1609, 2) if segment["length"] else 0,
            "paved": segment["paved"],
            "source": segment["source"],
            "geometry": geometry,
            "ways": segment["ways"],
        }

    def get_vector_tile(
        self,
        z: int,
        x: int,
        y: int,
        min_curvature: int = 300,
        source: Optional[str] = None,
    ) -> Optional[bytes]:
        """
        Get a Mapbox Vector Tile for the given ZXY coordinates.

        Args:
            z: Zoom level
            x: Tile column
            y: Tile row
            min_curvature: Minimum curvature score to include
            source: Optional source name to filter by

        Returns:
            Raw protobuf bytes, or None if the tile is empty
        """
        return self.curvature_repo.get_mvt_tile(
            z=z,
            x=x,
            y=y,
            min_curvature=min_curvature,
            source=source,
        )

    def get_source_bounds(self, source_name: str) -> Optional[Dict[str, float]]:
        """
        Get bounding box for a source.

        Args:
            source_name: Name of the source

        Returns:
            Bounds dictionary with west, south, east, north or None
        """
        return self.curvature_repo.get_source_bounds(source_name)

    def _build_feature_collection(
        self,
        segments: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Build a GeoJSON FeatureCollection from segment data.

        Args:
            segments: List of segment dictionaries from repository

        Returns:
            GeoJSON FeatureCollection
        """
        features = []

        for seg in segments:
            try:
                # Parse the geometry JSON string from PostGIS
                geometry = json.loads(seg["geometry"]) if seg["geometry"] else None

                if not geometry:
                    continue

                # Determine curvature level for styling
                curvature_level = self._get_curvature_level(seg["curvature"])

                feature = {
                    "type": "Feature",
                    "id": str(seg["id"]),
                    "geometry": geometry,
                    "properties": {
                        "id": seg["id"],
                        "id_hash": seg["id_hash"],
                        "name": seg["name"] or "Unnamed Road",
                        "curvature": seg["curvature"],
                        "curvature_level": curvature_level,
                        "length": seg["length"],
                        "length_km": (
                            round(seg["length"] / 1000, 2) if seg["length"] else 0
                        ),
                        "length_mi": (
                            round(seg["length"] / 1609, 2) if seg["length"] else 0
                        ),
                        "paved": seg["paved"],
                        "surface": "paved" if seg["paved"] else "unpaved",
                        "source": seg["source"],
                    },
                }
                features.append(feature)

            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Failed to process segment {seg.get('id')}: {e}")
                continue

        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "count": len(features),
            },
        }

    def _get_curvature_level(self, curvature: int) -> str:
        """
        Get curvature level category for styling.

        Args:
            curvature: Numeric curvature score

        Returns:
            Level string: mild, moderate, curvy, or extreme
        """
        if curvature is None:
            return "mild"
        if curvature < 600:
            return "mild"
        if curvature < 1000:
            return "moderate"
        if curvature < 2000:
            return "curvy"
        return "extreme"
