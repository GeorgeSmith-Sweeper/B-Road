"""
Repository for querying curvature_segments from the curvature PostGIS database.

This repository queries the curvature data loaded by the curvature processing
pipeline (bin/curvature-output-postgis). Data is stored in SRID 4326 (WGS84).
"""

from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class CurvatureRepository:
    """Repository for curvature_segments spatial queries."""

    def __init__(self, db: Session):
        self.db = db

    def get_segments_in_bbox(
        self,
        west: float,
        south: float,
        east: float,
        north: float,
        min_curvature: int = 300,
        limit: int = 1000,
        source: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get curvature segments within a bounding box.

        Args:
            west: Western longitude boundary
            south: Southern latitude boundary
            east: Eastern longitude boundary
            north: Northern latitude boundary
            min_curvature: Minimum curvature score (default 300)
            limit: Maximum number of segments to return (default 1000)
            source: Optional source name to filter by (e.g., "vermont")

        Returns:
            List of segment dictionaries with geometry as GeoJSON
        """
        # Build the query with optional source filter
        source_filter = ""
        if source:
            source_filter = "AND s.source = :source"

        query = text(f"""
            SELECT
                cs.id,
                cs.id_hash,
                cs.name,
                cs.curvature,
                cs.length,
                cs.paved,
                s.source as source_name,
                ST_AsGeoJSON(cs.geom) as geometry
            FROM curvature_segments cs
            LEFT JOIN sources s ON cs.fk_source = s.id
            WHERE ST_Intersects(
                cs.geom,
                ST_MakeEnvelope(:west, :south, :east, :north, 4326)
            )
            AND cs.curvature >= :min_curvature
            {source_filter}
            ORDER BY cs.curvature DESC
            LIMIT :limit
        """)

        params = {
            "west": west,
            "south": south,
            "east": east,
            "north": north,
            "min_curvature": min_curvature,
            "limit": limit,
        }
        if source:
            params["source"] = source

        result = self.db.execute(query, params)
        rows = result.fetchall()

        return [
            {
                "id": row.id,
                "id_hash": row.id_hash,
                "name": row.name,
                "curvature": row.curvature,
                "length": row.length,
                "paved": row.paved,
                "source": row.source_name,
                "geometry": row.geometry,
            }
            for row in rows
        ]

    def get_segments_by_source(
        self,
        source_name: str,
        min_curvature: int = 300,
        limit: int = 1000,
    ) -> List[Dict[str, Any]]:
        """
        Get curvature segments for a specific source (e.g., state).

        Args:
            source_name: Name of the source (e.g., "vermont")
            min_curvature: Minimum curvature score
            limit: Maximum number of segments to return

        Returns:
            List of segment dictionaries with geometry as GeoJSON
        """
        query = text("""
            SELECT
                cs.id,
                cs.id_hash,
                cs.name,
                cs.curvature,
                cs.length,
                cs.paved,
                s.source as source_name,
                ST_AsGeoJSON(cs.geom) as geometry
            FROM curvature_segments cs
            JOIN sources s ON cs.fk_source = s.id
            WHERE s.source = :source_name
            AND cs.curvature >= :min_curvature
            ORDER BY cs.curvature DESC
            LIMIT :limit
        """)

        result = self.db.execute(
            query,
            {
                "source_name": source_name,
                "min_curvature": min_curvature,
                "limit": limit,
            },
        )
        rows = result.fetchall()

        return [
            {
                "id": row.id,
                "id_hash": row.id_hash,
                "name": row.name,
                "curvature": row.curvature,
                "length": row.length,
                "paved": row.paved,
                "source": row.source_name,
                "geometry": row.geometry,
            }
            for row in rows
        ]

    def list_sources(self) -> List[Dict[str, Any]]:
        """
        List all available sources with segment counts.

        Returns:
            List of source dictionaries with name and segment_count
        """
        query = text("""
            SELECT
                s.id,
                s.source as name,
                COUNT(cs.id) as segment_count
            FROM sources s
            LEFT JOIN curvature_segments cs ON s.id = cs.fk_source
            GROUP BY s.id, s.source
            ORDER BY s.source
        """)

        result = self.db.execute(query)
        rows = result.fetchall()

        return [
            {
                "id": row.id,
                "name": row.name,
                "segment_count": row.segment_count,
            }
            for row in rows
        ]

    def get_segment_with_ways(
        self,
        segment_id: int,
    ) -> Optional[Dict[str, Any]]:
        """
        Get a single segment with its constituent ways and tags.

        Args:
            segment_id: The segment ID

        Returns:
            Segment dictionary with ways array, or None if not found
        """
        # Get the segment
        segment_query = text("""
            SELECT
                cs.id,
                cs.id_hash,
                cs.name,
                cs.curvature,
                cs.length,
                cs.paved,
                s.source as source_name,
                ST_AsGeoJSON(cs.geom) as geometry
            FROM curvature_segments cs
            LEFT JOIN sources s ON cs.fk_source = s.id
            WHERE cs.id = :segment_id
        """)

        result = self.db.execute(segment_query, {"segment_id": segment_id})
        segment_row = result.fetchone()

        if not segment_row:
            return None

        # Get the constituent ways with tags
        ways_query = text("""
            SELECT
                sw.id as way_id,
                sw.position,
                sw.name,
                sw.curvature,
                sw.length,
                sw.min_lon,
                sw.max_lon,
                sw.min_lat,
                sw.max_lat,
                ht.tag_value as highway,
                st.tag_value as surface
            FROM segment_ways sw
            LEFT JOIN tags ht ON sw.fk_highway = ht.tag_id
            LEFT JOIN tags st ON sw.fk_surface = st.tag_id
            WHERE sw.fk_segment = :segment_id
            ORDER BY sw.position
        """)

        ways_result = self.db.execute(ways_query, {"segment_id": segment_id})
        ways_rows = ways_result.fetchall()

        ways = [
            {
                "way_id": row.way_id,
                "position": row.position,
                "name": row.name,
                "curvature": row.curvature,
                "length": row.length,
                "bbox": {
                    "min_lon": row.min_lon,
                    "max_lon": row.max_lon,
                    "min_lat": row.min_lat,
                    "max_lat": row.max_lat,
                },
                "highway": row.highway,
                "surface": row.surface,
            }
            for row in ways_rows
        ]

        return {
            "id": segment_row.id,
            "id_hash": segment_row.id_hash,
            "name": segment_row.name,
            "curvature": segment_row.curvature,
            "length": segment_row.length,
            "paved": segment_row.paved,
            "source": segment_row.source_name,
            "geometry": segment_row.geometry,
            "ways": ways,
        }

    def get_mvt_tile(
        self,
        z: int,
        x: int,
        y: int,
        extent: int = 4096,
        min_curvature: int = 300,
        source: Optional[str] = None,
    ) -> Optional[bytes]:
        """
        Get a Mapbox Vector Tile (MVT) for the given ZXY coordinates.

        Uses ST_AsMVT and ST_AsMVTGeom to produce a protobuf-encoded tile
        that Mapbox GL JS can render natively.

        Args:
            z: Zoom level
            x: Tile column
            y: Tile row
            extent: Tile extent in pixels (default 4096)
            min_curvature: Minimum curvature score to include
            source: Optional source name to filter by

        Returns:
            Raw protobuf bytes, or None if the tile is empty
        """
        from api.utils.tile_math import tile_to_bbox

        west, south, east, north = tile_to_bbox(z, x, y)

        source_filter = ""
        if source:
            source_filter = "AND s.source = :source"

        query = text(f"""
            WITH tile_bounds AS (
                SELECT ST_MakeEnvelope(:west, :south, :east, :north, 4326) AS geom
            ),
            mvt_data AS (
                SELECT
                    cs.id,
                    cs.name,
                    cs.curvature,
                    cs.length,
                    cs.paved,
                    s.source AS source_name,
                    ST_AsMVTGeom(
                        cs.geom,
                        tb.geom,
                        :extent,
                        256,
                        true
                    ) AS geom
                FROM curvature_segments cs
                LEFT JOIN sources s ON cs.fk_source = s.id
                CROSS JOIN tile_bounds tb
                WHERE cs.geom && tb.geom
                AND cs.curvature >= :min_curvature
                {source_filter}
            )
            SELECT ST_AsMVT(mvt_data, 'curvature', :extent, 'geom') AS tile
            FROM mvt_data
            WHERE geom IS NOT NULL
        """)

        params: Dict[str, Any] = {
            "west": west,
            "south": south,
            "east": east,
            "north": north,
            "extent": extent,
            "min_curvature": min_curvature,
        }
        if source:
            params["source"] = source

        result = self.db.execute(query, params)
        row = result.fetchone()

        if not row or not row.tile or len(row.tile) == 0:
            return None

        return bytes(row.tile)

    def search_by_filters(
        self,
        filters: Dict[str, Any],
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Search segments using flexible filters from natural language queries.

        Args:
            filters: Dictionary of filter parameters:
                - min_curvature: Minimum curvature score
                - max_curvature: Maximum curvature score
                - min_length_meters: Minimum length in meters
                - max_length_meters: Maximum length in meters
                - surface_types: List of surface types ("paved", "unpaved")
                - sources: List of source names (state names)
            limit: Maximum number of segments to return

        Returns:
            List of segment dictionaries with geometry as GeoJSON
        """
        # Build dynamic WHERE clauses
        where_clauses = []
        params: Dict[str, Any] = {"limit": limit}

        # Curvature filters
        if "min_curvature" in filters:
            where_clauses.append("cs.curvature >= :min_curvature")
            params["min_curvature"] = filters["min_curvature"]
        else:
            # Default minimum curvature
            where_clauses.append("cs.curvature >= 300")

        if "max_curvature" in filters:
            where_clauses.append("cs.curvature <= :max_curvature")
            params["max_curvature"] = filters["max_curvature"]

        # Length filters
        if "min_length_meters" in filters:
            where_clauses.append("cs.length >= :min_length_meters")
            params["min_length_meters"] = filters["min_length_meters"]

        if "max_length_meters" in filters:
            where_clauses.append("cs.length <= :max_length_meters")
            params["max_length_meters"] = filters["max_length_meters"]

        # Surface type filter
        if "surface_types" in filters and filters["surface_types"]:
            surface_types = filters["surface_types"]
            if "paved" in surface_types and "unpaved" not in surface_types:
                where_clauses.append("cs.paved = true")
            elif "unpaved" in surface_types and "paved" not in surface_types:
                where_clauses.append("cs.paved = false")
            # If both are present, no filter needed

        # Source filter (state names)
        if "sources" in filters and filters["sources"]:
            # Use ANY for array matching
            where_clauses.append("s.source = ANY(:sources)")
            params["sources"] = filters["sources"]

        # Build the query
        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

        query = text(f"""
            SELECT
                cs.id,
                cs.id_hash,
                cs.name,
                cs.curvature,
                cs.length,
                cs.paved,
                s.source as source_name,
                ST_AsGeoJSON(cs.geom) as geometry
            FROM curvature_segments cs
            LEFT JOIN sources s ON cs.fk_source = s.id
            WHERE {where_sql}
            ORDER BY cs.curvature DESC
            LIMIT :limit
        """)

        result = self.db.execute(query, params)
        rows = result.fetchall()

        return [
            {
                "id": row.id,
                "id_hash": row.id_hash,
                "name": row.name,
                "curvature": row.curvature,
                "length": row.length,
                "paved": row.paved,
                "source": row.source_name,
                "geometry": row.geometry,
            }
            for row in rows
        ]

    def get_source_bounds(self, source_name: str) -> Optional[Dict[str, float]]:
        """
        Get the bounding box for all segments from a source.

        Args:
            source_name: Name of the source (e.g., "vermont")

        Returns:
            Dictionary with west, south, east, north bounds in WGS84
        """
        query = text("""
            SELECT
                ST_XMin(ST_Extent(cs.geom)) as west,
                ST_YMin(ST_Extent(cs.geom)) as south,
                ST_XMax(ST_Extent(cs.geom)) as east,
                ST_YMax(ST_Extent(cs.geom)) as north
            FROM curvature_segments cs
            JOIN sources s ON cs.fk_source = s.id
            WHERE s.source = :source_name
        """)

        result = self.db.execute(query, {"source_name": source_name})
        row = result.fetchone()

        if not row or row.west is None:
            return None

        return {
            "west": row.west,
            "south": row.south,
            "east": row.east,
            "north": row.north,
        }
