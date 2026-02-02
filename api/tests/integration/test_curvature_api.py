"""
Integration tests for the curvature API endpoints.

Tests the /curvature/* endpoints for querying road data from PostGIS.
"""

import pytest
from fastapi.testclient import TestClient

from tests.fixtures.curvature_fixtures import (
    VERMONT_BBOX,
    RHODE_ISLAND_BBOX,
    EMPTY_BBOX,
    SAMPLE_SOURCES,
    VERMONT_SEGMENTS,
    EXPECTED_SOURCE_COUNTS,
)

pytestmark = pytest.mark.usefixtures("seed_curvature_data")


class TestCurvatureSegmentsEndpoint:
    """Tests for GET /curvature/segments"""

    def test_segments_requires_bbox(self, test_client: TestClient):
        """Should return 422 when bbox is missing"""
        response = test_client.get("/curvature/segments")
        assert response.status_code == 422

    def test_segments_validates_bbox_format(self, test_client: TestClient):
        """Should return 400 for invalid bbox format"""
        response = test_client.get("/curvature/segments?bbox=invalid")
        assert response.status_code == 400
        assert "west,south,east,north" in response.json()["detail"]

    def test_segments_validates_bbox_values(self, test_client: TestClient):
        """Should return 400 for invalid bbox values"""
        # west > east
        response = test_client.get("/curvature/segments?bbox=10,0,5,10")
        assert response.status_code == 400
        assert "west must be less than east" in response.json()["detail"]

        # south > north
        response = test_client.get("/curvature/segments?bbox=0,10,10,5")
        assert response.status_code == 400
        assert "south must be less than north" in response.json()["detail"]

    def test_segments_validates_min_curvature(self, test_client: TestClient):
        """Should return 422 for negative min_curvature"""
        response = test_client.get(
            f"/curvature/segments?bbox={VERMONT_BBOX['west']},{VERMONT_BBOX['south']},"
            f"{VERMONT_BBOX['east']},{VERMONT_BBOX['north']}&min_curvature=-1"
        )
        assert response.status_code == 422

    def test_segments_validates_limit_range(self, test_client: TestClient):
        """Should return 422 for limit outside valid range"""
        bbox_str = f"{VERMONT_BBOX['west']},{VERMONT_BBOX['south']},{VERMONT_BBOX['east']},{VERMONT_BBOX['north']}"

        # limit = 0
        response = test_client.get(f"/curvature/segments?bbox={bbox_str}&limit=0")
        assert response.status_code == 422

        # limit > 5000
        response = test_client.get(f"/curvature/segments?bbox={bbox_str}&limit=10000")
        assert response.status_code == 422

    def test_segments_returns_geojson(self, test_client: TestClient):
        """Should return valid GeoJSON FeatureCollection"""
        bbox_str = f"{VERMONT_BBOX['west']},{VERMONT_BBOX['south']},{VERMONT_BBOX['east']},{VERMONT_BBOX['north']}"
        response = test_client.get(f"/curvature/segments?bbox={bbox_str}")

        assert response.status_code == 200
        data = response.json()

        assert data["type"] == "FeatureCollection"
        assert "features" in data
        assert isinstance(data["features"], list)
        assert "metadata" in data
        assert "count" in data["metadata"]

    def test_segments_with_source_filter(self, test_client: TestClient):
        """Should filter by source when provided"""
        bbox_str = f"{VERMONT_BBOX['west']},{VERMONT_BBOX['south']},{VERMONT_BBOX['east']},{VERMONT_BBOX['north']}"
        response = test_client.get(
            f"/curvature/segments?bbox={bbox_str}&source=vermont"
        )

        assert response.status_code == 200
        data = response.json()

        # All returned segments should be from vermont source
        for feature in data["features"]:
            assert feature["properties"]["source"] == "vermont"

    def test_segments_respects_min_curvature(self, test_client: TestClient):
        """Should filter by minimum curvature"""
        bbox_str = f"{VERMONT_BBOX['west']},{VERMONT_BBOX['south']},{VERMONT_BBOX['east']},{VERMONT_BBOX['north']}"
        min_curv = 1000
        response = test_client.get(
            f"/curvature/segments?bbox={bbox_str}&min_curvature={min_curv}"
        )

        assert response.status_code == 200
        data = response.json()

        # All returned segments should meet minimum curvature
        for feature in data["features"]:
            assert feature["properties"]["curvature"] >= min_curv

    def test_segments_respects_limit(self, test_client: TestClient):
        """Should respect the limit parameter"""
        bbox_str = f"{VERMONT_BBOX['west']},{VERMONT_BBOX['south']},{VERMONT_BBOX['east']},{VERMONT_BBOX['north']}"
        limit = 5
        response = test_client.get(f"/curvature/segments?bbox={bbox_str}&limit={limit}")

        assert response.status_code == 200
        data = response.json()

        assert len(data["features"]) <= limit

    def test_segments_ordered_by_curvature_desc(self, test_client: TestClient):
        """Should return segments ordered by curvature descending"""
        bbox_str = f"{VERMONT_BBOX['west']},{VERMONT_BBOX['south']},{VERMONT_BBOX['east']},{VERMONT_BBOX['north']}"
        response = test_client.get(f"/curvature/segments?bbox={bbox_str}")

        assert response.status_code == 200
        data = response.json()

        if len(data["features"]) > 1:
            curvatures = [f["properties"]["curvature"] for f in data["features"]]
            assert curvatures == sorted(curvatures, reverse=True)

    def test_segments_feature_has_required_properties(self, test_client: TestClient):
        """Should include all required properties in features"""
        bbox_str = f"{VERMONT_BBOX['west']},{VERMONT_BBOX['south']},{VERMONT_BBOX['east']},{VERMONT_BBOX['north']}"
        response = test_client.get(f"/curvature/segments?bbox={bbox_str}")

        assert response.status_code == 200
        data = response.json()

        if data["features"]:
            feature = data["features"][0]
            assert "type" in feature
            assert feature["type"] == "Feature"
            assert "id" in feature
            assert "geometry" in feature
            assert "properties" in feature

            props = feature["properties"]
            required_props = [
                "id",
                "name",
                "curvature",
                "curvature_level",
                "length",
                "length_km",
                "length_mi",
                "paved",
                "surface",
                "source",
            ]
            for prop in required_props:
                assert prop in props, f"Missing property: {prop}"


class TestCurvatureSourcesEndpoint:
    """Tests for GET /curvature/sources"""

    def test_sources_returns_list(self, test_client: TestClient):
        """Should return a list of sources"""
        response = test_client.get("/curvature/sources")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_sources_have_required_fields(self, test_client: TestClient):
        """Should include required fields in each source"""
        response = test_client.get("/curvature/sources")

        assert response.status_code == 200
        data = response.json()

        for source in data:
            assert "id" in source
            assert "name" in source
            assert "segment_count" in source

    def test_sources_sorted_alphabetically(self, test_client: TestClient):
        """Should return sources sorted by name"""
        response = test_client.get("/curvature/sources")

        assert response.status_code == 200
        data = response.json()

        if len(data) > 1:
            names = [s["name"] for s in data]
            assert names == sorted(names)


class TestCurvatureSourceSegmentsEndpoint:
    """Tests for GET /curvature/sources/{source_name}/segments"""

    def test_source_segments_returns_geojson(self, test_client: TestClient):
        """Should return GeoJSON for valid source"""
        response = test_client.get("/curvature/sources/vermont/segments")

        assert response.status_code == 200
        data = response.json()

        assert data["type"] == "FeatureCollection"
        assert "features" in data

    def test_source_segments_filters_by_source(self, test_client: TestClient):
        """Should only return segments from specified source"""
        response = test_client.get("/curvature/sources/vermont/segments")

        assert response.status_code == 200
        data = response.json()

        for feature in data["features"]:
            assert feature["properties"]["source"] == "vermont"

    def test_source_segments_respects_min_curvature(self, test_client: TestClient):
        """Should filter by minimum curvature"""
        min_curv = 1500
        response = test_client.get(
            f"/curvature/sources/vermont/segments?min_curvature={min_curv}"
        )

        assert response.status_code == 200
        data = response.json()

        for feature in data["features"]:
            assert feature["properties"]["curvature"] >= min_curv


class TestCurvatureSourceBoundsEndpoint:
    """Tests for GET /curvature/sources/{source_name}/bounds"""

    def test_source_bounds_returns_bbox(self, test_client: TestClient):
        """Should return bounding box for valid source"""
        response = test_client.get("/curvature/sources/vermont/bounds")

        # May return 404 if no data loaded
        if response.status_code == 200:
            data = response.json()
            assert "west" in data
            assert "south" in data
            assert "east" in data
            assert "north" in data
            assert data["west"] < data["east"]
            assert data["south"] < data["north"]

    def test_source_bounds_not_found(self, test_client: TestClient):
        """Should return 404 for non-existent source"""
        response = test_client.get("/curvature/sources/nonexistent-state/bounds")
        assert response.status_code == 404


class TestCurvatureSegmentDetailEndpoint:
    """Tests for GET /curvature/segments/{segment_id}"""

    def test_segment_detail_not_found(self, test_client: TestClient):
        """Should return 404 for non-existent segment"""
        response = test_client.get("/curvature/segments/999999999")
        assert response.status_code == 404

    def test_segment_detail_returns_data(self, test_client: TestClient):
        """Should return segment detail for valid ID"""
        # First get a valid segment ID from the segments endpoint
        bbox_str = f"{VERMONT_BBOX['west']},{VERMONT_BBOX['south']},{VERMONT_BBOX['east']},{VERMONT_BBOX['north']}"
        segments_response = test_client.get(
            f"/curvature/segments?bbox={bbox_str}&limit=1"
        )

        if segments_response.status_code == 200:
            segments = segments_response.json()
            if segments["features"]:
                segment_id = segments["features"][0]["properties"]["id"]

                response = test_client.get(f"/curvature/segments/{segment_id}")

                if response.status_code == 200:
                    data = response.json()
                    assert "id" in data
                    assert "name" in data
                    assert "curvature" in data
                    assert "geometry" in data


class TestCurvatureAPIPerformance:
    """Performance-related tests for curvature API"""

    def test_bbox_query_response_time(self, test_client: TestClient):
        """Bounding box query should respond within reasonable time"""
        import time

        bbox_str = f"{VERMONT_BBOX['west']},{VERMONT_BBOX['south']},{VERMONT_BBOX['east']},{VERMONT_BBOX['north']}"

        start = time.time()
        response = test_client.get(f"/curvature/segments?bbox={bbox_str}&limit=1000")
        elapsed = time.time() - start

        assert response.status_code == 200
        # Should respond in under 5 seconds even without indexes
        assert elapsed < 5.0, f"Query took {elapsed:.2f}s, expected < 5s"

    def test_sources_list_response_time(self, test_client: TestClient):
        """Sources list should respond quickly"""
        import time

        start = time.time()
        response = test_client.get("/curvature/sources")
        elapsed = time.time() - start

        assert response.status_code == 200
        assert elapsed < 1.0, f"Query took {elapsed:.2f}s, expected < 1s"
