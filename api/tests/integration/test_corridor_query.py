"""
Integration tests for the corridor spatial query.

Tests get_segments_in_corridor() against a real PostGIS database
using the curvature fixtures (Vermont/RI/Delaware segments).
"""

import json
import pytest

from api.repositories.curvature_repository import CurvatureRepository


@pytest.mark.integration
@pytest.mark.spatial
class TestCorridorQuery:
    """Tests for get_segments_in_corridor() repository method."""

    def test_finds_segments_near_route(self, test_db_session, seed_curvature_data):
        """Segments within the corridor buffer are returned."""
        repo = CurvatureRepository(test_db_session)

        # Route line passing through Vermont (near the fixture segments)
        route_geojson = json.dumps(
            {
                "type": "LineString",
                "coordinates": [
                    [-72.5, 44.3],
                    [-72.6, 44.25],
                    [-72.7, 44.1],
                    [-72.9, 44.0],
                ],
            }
        )

        results = repo.get_segments_in_corridor(
            route_geojson=route_geojson,
            buffer_meters=30000,  # 30km buffer to catch nearby fixtures
            min_curvature=500,
            min_length=500,
        )

        assert len(results) > 0
        # All results should have required fields
        for seg in results:
            assert "id" in seg
            assert "curvature" in seg
            assert "route_position" in seg
            assert "distance_from_route" in seg
            assert "centroid_lng" in seg
            assert "centroid_lat" in seg
            assert seg["curvature"] >= 500

    def test_route_position_between_zero_and_one(
        self, test_db_session, seed_curvature_data
    ):
        """route_position values are in [0, 1] range."""
        repo = CurvatureRepository(test_db_session)

        route_geojson = json.dumps(
            {
                "type": "LineString",
                "coordinates": [
                    [-72.5, 44.3],
                    [-72.6, 44.25],
                    [-72.7, 44.1],
                    [-72.95, 44.0],
                ],
            }
        )

        results = repo.get_segments_in_corridor(
            route_geojson=route_geojson,
            buffer_meters=50000,
            min_curvature=300,
            min_length=0,
        )

        for seg in results:
            assert (
                0 <= seg["route_position"] <= 1
            ), f"Segment {seg['id']} route_position {seg['route_position']} out of range"

    def test_filters_by_min_curvature(self, test_db_session, seed_curvature_data):
        """Only segments above min_curvature threshold are returned."""
        repo = CurvatureRepository(test_db_session)

        route_geojson = json.dumps(
            {
                "type": "LineString",
                "coordinates": [[-73.5, 45.0], [-71.0, 41.0]],
            }
        )

        results = repo.get_segments_in_corridor(
            route_geojson=route_geojson,
            buffer_meters=100000,  # Very wide to catch everything
            min_curvature=2000,
            min_length=0,
        )

        for seg in results:
            assert seg["curvature"] >= 2000

    def test_filters_by_min_length(self, test_db_session, seed_curvature_data):
        """Only segments above min_length threshold are returned."""
        repo = CurvatureRepository(test_db_session)

        route_geojson = json.dumps(
            {
                "type": "LineString",
                "coordinates": [[-73.5, 45.0], [-71.0, 41.0]],
            }
        )

        results = repo.get_segments_in_corridor(
            route_geojson=route_geojson,
            buffer_meters=100000,
            min_curvature=300,
            min_length=10000,
        )

        for seg in results:
            assert seg["length"] >= 10000

    def test_only_returns_paved_segments(self, test_db_session, seed_curvature_data):
        """Unpaved segments (like RI Gravel Path) are excluded."""
        repo = CurvatureRepository(test_db_session)

        # Route near Rhode Island where there's both paved and unpaved
        route_geojson = json.dumps(
            {
                "type": "LineString",
                "coordinates": [[-71.3, 41.4], [-71.6, 41.7]],
            }
        )

        results = repo.get_segments_in_corridor(
            route_geojson=route_geojson,
            buffer_meters=50000,
            min_curvature=300,
            min_length=0,
        )

        # Gravel Path (id=7, paved=False) should NOT appear
        result_ids = [seg["id"] for seg in results]
        assert 7 not in result_ids

    def test_empty_result_for_distant_route(self, test_db_session, seed_curvature_data):
        """Route far from any segments returns empty list."""
        repo = CurvatureRepository(test_db_session)

        # Route in California — nowhere near fixtures
        route_geojson = json.dumps(
            {
                "type": "LineString",
                "coordinates": [[-122.0, 37.0], [-121.0, 36.0]],
            }
        )

        results = repo.get_segments_in_corridor(
            route_geojson=route_geojson,
            buffer_meters=15000,
            min_curvature=500,
            min_length=500,
        )

        assert results == []

    def test_respects_limit(self, test_db_session, seed_curvature_data):
        """Result count does not exceed the limit parameter."""
        repo = CurvatureRepository(test_db_session)

        route_geojson = json.dumps(
            {
                "type": "LineString",
                "coordinates": [[-73.5, 45.0], [-71.0, 41.0]],
            }
        )

        results = repo.get_segments_in_corridor(
            route_geojson=route_geojson,
            buffer_meters=100000,
            min_curvature=300,
            min_length=0,
            limit=2,
        )

        assert len(results) <= 2

    def test_ordered_by_curvature_descending(
        self, test_db_session, seed_curvature_data
    ):
        """Results are ordered by curvature descending."""
        repo = CurvatureRepository(test_db_session)

        route_geojson = json.dumps(
            {
                "type": "LineString",
                "coordinates": [[-73.5, 45.0], [-71.0, 41.0]],
            }
        )

        results = repo.get_segments_in_corridor(
            route_geojson=route_geojson,
            buffer_meters=100000,
            min_curvature=300,
            min_length=0,
        )

        if len(results) > 1:
            curvatures = [s["curvature"] for s in results]
            assert curvatures == sorted(curvatures, reverse=True)

    def test_centroid_coordinates_are_valid(self, test_db_session, seed_curvature_data):
        """Centroid coordinates are valid lng/lat values."""
        repo = CurvatureRepository(test_db_session)

        route_geojson = json.dumps(
            {
                "type": "LineString",
                "coordinates": [[-73.5, 45.0], [-71.0, 41.0]],
            }
        )

        results = repo.get_segments_in_corridor(
            route_geojson=route_geojson,
            buffer_meters=100000,
            min_curvature=300,
            min_length=0,
        )

        for seg in results:
            assert -180 <= seg["centroid_lng"] <= 180
            assert -90 <= seg["centroid_lat"] <= 90
