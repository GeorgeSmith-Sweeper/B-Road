"""
Integration tests for search_by_filters on repository and service layers.

Tests the dynamic filter query against real PostGIS data seeded
from curvature_fixtures.
"""

import pytest
from sqlalchemy.orm import sessionmaker

from api.repositories.curvature_repository import CurvatureRepository
from api.services.curvature_service import CurvatureService
from tests.fixtures.curvature_fixtures import (
    VERMONT_SEGMENTS,
    RHODE_ISLAND_SEGMENTS,
    ALL_SEGMENTS,
)

pytestmark = pytest.mark.usefixtures("seed_curvature_data")


@pytest.fixture
def curvature_repo(test_engine):
    """Create a CurvatureRepository with a test database session."""
    Session = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = Session()
    yield CurvatureRepository(session)
    session.close()


@pytest.fixture
def curvature_service(test_engine):
    """Create a CurvatureService with a test database session."""
    Session = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = Session()
    yield CurvatureService(session)
    session.close()


class TestRepositorySearchByFilters:
    """Tests for CurvatureRepository.search_by_filters()"""

    # --- Curvature filtering ---

    def test_filter_by_min_curvature(self, curvature_repo):
        """Should return only segments at or above min_curvature."""
        results = curvature_repo.search_by_filters({"min_curvature": 2000})
        assert len(results) > 0
        for seg in results:
            assert seg["curvature"] >= 2000

    def test_filter_by_max_curvature(self, curvature_repo):
        """Should return only segments at or below max_curvature."""
        results = curvature_repo.search_by_filters(
            {"min_curvature": 300, "max_curvature": 1000}
        )
        for seg in results:
            assert seg["curvature"] <= 1000

    def test_filter_by_curvature_range(self, curvature_repo):
        """Should return segments within curvature range."""
        results = curvature_repo.search_by_filters(
            {"min_curvature": 1000, "max_curvature": 3000}
        )
        for seg in results:
            assert 1000 <= seg["curvature"] <= 3000

    def test_default_min_curvature_300(self, curvature_repo):
        """Should use 300 as default min_curvature when not specified."""
        results = curvature_repo.search_by_filters({})
        # Delaware "Coastal Highway" has curvature 250, should be excluded
        for seg in results:
            assert seg["curvature"] >= 300

    # --- Length filtering ---

    def test_filter_by_min_length(self, curvature_repo):
        """Should return only segments at or above min_length_meters."""
        results = curvature_repo.search_by_filters(
            {"min_length_meters": 15000}
        )
        assert len(results) > 0
        for seg in results:
            assert seg["length"] >= 15000

    def test_filter_by_max_length(self, curvature_repo):
        """Should return only segments at or below max_length_meters."""
        results = curvature_repo.search_by_filters(
            {"max_length_meters": 10000}
        )
        for seg in results:
            assert seg["length"] <= 10000

    # --- Surface type filtering ---

    def test_filter_paved_only(self, curvature_repo):
        """Should return only paved segments."""
        results = curvature_repo.search_by_filters(
            {"surface_types": ["paved"]}
        )
        for seg in results:
            assert seg["paved"] is True

    def test_filter_unpaved_only(self, curvature_repo):
        """Should return only unpaved segments."""
        results = curvature_repo.search_by_filters(
            {"surface_types": ["unpaved"]}
        )
        for seg in results:
            assert seg["paved"] is False

    def test_filter_both_surfaces_no_restriction(self, curvature_repo):
        """Specifying both paved and unpaved should not filter by surface."""
        all_results = curvature_repo.search_by_filters({})
        both_results = curvature_repo.search_by_filters(
            {"surface_types": ["paved", "unpaved"]}
        )
        # Should return the same segments
        assert len(both_results) == len(all_results)

    # --- Source filtering ---

    def test_filter_by_single_source(self, curvature_repo):
        """Should return only segments from specified source."""
        results = curvature_repo.search_by_filters(
            {"sources": ["vermont"]}
        )
        assert len(results) > 0
        for seg in results:
            assert seg["source"] == "vermont"

    def test_filter_by_multiple_sources(self, curvature_repo):
        """Should return segments from any of the specified sources."""
        results = curvature_repo.search_by_filters(
            {"sources": ["vermont", "rhode-island"]}
        )
        sources = {seg["source"] for seg in results}
        assert sources <= {"vermont", "rhode-island"}

    def test_filter_by_nonexistent_source(self, curvature_repo):
        """Should return empty results for unknown source."""
        results = curvature_repo.search_by_filters(
            {"sources": ["nonexistent"]}
        )
        assert results == []

    # --- Combined filters ---

    def test_combined_curvature_and_source(self, curvature_repo):
        """Should apply both curvature and source filters."""
        results = curvature_repo.search_by_filters(
            {"min_curvature": 2000, "sources": ["vermont"]}
        )
        for seg in results:
            assert seg["curvature"] >= 2000
            assert seg["source"] == "vermont"

    def test_combined_all_filters(self, curvature_repo):
        """Should apply curvature, length, surface, and source filters."""
        results = curvature_repo.search_by_filters(
            {
                "min_curvature": 1000,
                "max_curvature": 5000,
                "min_length_meters": 10000,
                "surface_types": ["paved"],
                "sources": ["vermont"],
            }
        )
        for seg in results:
            assert 1000 <= seg["curvature"] <= 5000
            assert seg["length"] >= 10000
            assert seg["paved"] is True
            assert seg["source"] == "vermont"

    # --- Ordering and limit ---

    def test_results_ordered_by_curvature_desc(self, curvature_repo):
        """Should return results ordered by curvature descending."""
        results = curvature_repo.search_by_filters({"min_curvature": 300})
        if len(results) > 1:
            curvatures = [seg["curvature"] for seg in results]
            assert curvatures == sorted(curvatures, reverse=True)

    def test_limit_parameter(self, curvature_repo):
        """Should respect the limit parameter."""
        results = curvature_repo.search_by_filters({}, limit=2)
        assert len(results) <= 2

    # --- Result structure ---

    def test_result_has_required_fields(self, curvature_repo):
        """Each result should have all expected fields."""
        results = curvature_repo.search_by_filters({"min_curvature": 300})
        assert len(results) > 0
        for seg in results:
            assert "id" in seg
            assert "id_hash" in seg
            assert "name" in seg
            assert "curvature" in seg
            assert "length" in seg
            assert "paved" in seg
            assert "source" in seg
            assert "geometry" in seg

    def test_geometry_is_geojson_string(self, curvature_repo):
        """Geometry field should be a valid GeoJSON string."""
        import json

        results = curvature_repo.search_by_filters({"min_curvature": 300})
        assert len(results) > 0
        geom = json.loads(results[0]["geometry"])
        assert geom["type"] == "LineString"
        assert "coordinates" in geom

    # --- Empty results ---

    def test_no_matching_segments(self, curvature_repo):
        """Should return empty list when no segments match."""
        results = curvature_repo.search_by_filters(
            {"min_curvature": 999999}
        )
        assert results == []


class TestServiceSearchByFilters:
    """Tests for CurvatureService.search_by_filters()"""

    def test_returns_feature_collection(self, curvature_service):
        """Should return a GeoJSON FeatureCollection."""
        result = curvature_service.search_by_filters(
            {"min_curvature": 1000, "sources": ["vermont"]}
        )
        assert result["type"] == "FeatureCollection"
        assert "features" in result
        assert "metadata" in result
        assert "count" in result["metadata"]

    def test_features_have_correct_structure(self, curvature_service):
        """Features should have type, id, geometry, and properties."""
        result = curvature_service.search_by_filters(
            {"min_curvature": 1000, "sources": ["vermont"]}
        )
        assert len(result["features"]) > 0

        feature = result["features"][0]
        assert feature["type"] == "Feature"
        assert "id" in feature
        assert "geometry" in feature
        assert feature["geometry"]["type"] == "LineString"
        assert "properties" in feature

    def test_properties_include_computed_fields(self, curvature_service):
        """Should include computed fields like length_km, length_mi, curvature_level."""
        result = curvature_service.search_by_filters(
            {"min_curvature": 1000, "sources": ["vermont"]}
        )
        props = result["features"][0]["properties"]
        assert "length_km" in props
        assert "length_mi" in props
        assert "curvature_level" in props
        assert "surface" in props

    def test_count_matches_features(self, curvature_service):
        """Metadata count should match number of features."""
        result = curvature_service.search_by_filters(
            {"min_curvature": 300}
        )
        assert result["metadata"]["count"] == len(result["features"])

    def test_unnamed_roads_get_default_name(self, curvature_service):
        """Roads without a name should display as 'Unnamed Road'."""
        # This tests the _build_feature_collection logic
        result = curvature_service.search_by_filters({"min_curvature": 300})
        for feature in result["features"]:
            assert feature["properties"]["name"] is not None

    def test_empty_results_structure(self, curvature_service):
        """Empty results should still have valid FeatureCollection structure."""
        result = curvature_service.search_by_filters(
            {"min_curvature": 999999}
        )
        assert result["type"] == "FeatureCollection"
        assert result["features"] == []
        assert result["metadata"]["count"] == 0

    def test_curvature_level_assignment(self, curvature_service):
        """Should assign correct curvature level labels."""
        result = curvature_service.search_by_filters({"min_curvature": 300})
        for feature in result["features"]:
            curv = feature["properties"]["curvature"]
            level = feature["properties"]["curvature_level"]
            if curv < 600:
                assert level == "relaxed"
            elif curv < 1000:
                assert level == "spirited"
            elif curv < 2000:
                assert level == "engaging"
            elif curv < 5000:
                assert level == "technical"
            elif curv < 10000:
                assert level == "expert"
            else:
                assert level == "legendary"

    def test_respects_limit(self, curvature_service):
        """Should pass limit through to repository."""
        result = curvature_service.search_by_filters({}, limit=1)
        assert len(result["features"]) <= 1

    def test_surface_label_matches_paved(self, curvature_service):
        """Surface property should say 'paved' or 'unpaved' based on boolean."""
        result = curvature_service.search_by_filters({"min_curvature": 300})
        for feature in result["features"]:
            if feature["properties"]["paved"]:
                assert feature["properties"]["surface"] == "paved"
            else:
                assert feature["properties"]["surface"] == "unpaved"
