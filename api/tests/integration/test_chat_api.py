"""
Integration tests for the chat API endpoints.

Tests /chat/* endpoints with mocked ClaudeService (no real API calls)
and real database for the search endpoint.
"""

import json
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from tests.fixtures.curvature_fixtures import VERMONT_SEGMENTS

pytestmark = pytest.mark.usefixtures("seed_curvature_data")


class TestChatHealthEndpoint:
    """Tests for GET /chat/health"""

    def test_returns_ok_status(self, test_client: TestClient):
        """Should return status ok regardless of Claude availability."""
        response = test_client.get("/chat/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "chat"

    def test_reports_claude_availability(self, test_client: TestClient):
        """Should include claude_available field."""
        response = test_client.get("/chat/health")
        assert response.status_code == 200
        data = response.json()
        assert "claude_available" in data
        assert isinstance(data["claude_available"], bool)

    @patch("api.routers.chat.ClaudeService")
    def test_claude_available_when_key_set(
        self, mock_service_cls, test_client: TestClient
    ):
        """Should report claude available when service initializes."""
        mock_instance = MagicMock()
        mock_instance.is_available.return_value = True
        mock_service_cls.return_value = mock_instance

        response = test_client.get("/chat/health")
        assert response.status_code == 200
        assert response.json()["claude_available"] is True

    @patch("api.routers.chat.ClaudeService")
    def test_claude_unavailable_on_init_error(
        self, mock_service_cls, test_client: TestClient
    ):
        """Should report claude unavailable when service fails to init."""
        mock_service_cls.side_effect = ValueError("No API key")

        response = test_client.get("/chat/health")
        assert response.status_code == 200
        assert response.json()["claude_available"] is False


class TestChatTestEndpoint:
    """Tests for POST /chat/test"""

    @patch("api.routers.chat.ClaudeService")
    def test_returns_message_and_response(
        self, mock_service_cls, test_client: TestClient
    ):
        """Should return original message and Claude's response."""
        mock_instance = MagicMock()
        mock_instance.send_message = AsyncMock(return_value="I'm here!")
        mock_service_cls.return_value = mock_instance

        response = test_client.post("/chat/test?message=Hello")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Hello"
        assert data["response"] == "I'm here!"

    def test_requires_message_parameter(self, test_client: TestClient):
        """Should return 422 when message param is missing."""
        response = test_client.post("/chat/test")
        assert response.status_code == 422

    @patch("api.routers.chat.ClaudeService")
    def test_returns_503_when_no_api_key(
        self, mock_service_cls, test_client: TestClient
    ):
        """Should return 503 when Claude service can't initialize."""
        mock_service_cls.side_effect = ValueError("ANTHROPIC_API_KEY not set")

        response = test_client.post("/chat/test?message=Hello")
        assert response.status_code == 503


class TestBuildQueryEndpoint:
    """Tests for POST /chat/build-query"""

    def test_builds_filters_from_params(self, test_client: TestClient):
        """Should build filters from explicit parameters."""
        response = test_client.post(
            "/chat/build-query?min_curvature=1000&max_curvature=5000"
        )
        assert response.status_code == 200
        data = response.json()
        assert "filters" in data
        assert data["filters"]["min_curvature"] == 1000
        assert data["filters"]["max_curvature"] == 5000

    def test_builds_with_curvature_level(self, test_client: TestClient):
        """Should accept curvature_level parameter."""
        response = test_client.post("/chat/build-query?curvature_level=extreme")
        assert response.status_code == 200
        data = response.json()
        assert data["filters"]["min_curvature"] == 5000
        assert data["filters"]["max_curvature"] == 10000

    def test_builds_with_length_params(self, test_client: TestClient):
        """Should handle min_length and max_length."""
        response = test_client.post(
            "/chat/build-query?min_length=5&max_length=20"
        )
        assert response.status_code == 200
        data = response.json()
        assert "min_length_meters" in data["filters"]
        assert "max_length_meters" in data["filters"]

    def test_no_params_returns_empty_filters(self, test_client: TestClient):
        """Should return empty filters when no params provided."""
        response = test_client.post("/chat/build-query")
        assert response.status_code == 200
        data = response.json()
        assert data["filters"] == {}

    def test_validation_error_returns_400(self, test_client: TestClient):
        """Should return 400 with errors for invalid filter combinations."""
        # min > max curvature
        response = test_client.post(
            "/chat/build-query?min_curvature=5000&max_curvature=1000"
        )
        assert response.status_code == 400
        data = response.json()
        assert "errors" in data["detail"]


class TestExtractFiltersEndpoint:
    """Tests for POST /chat/extract-filters"""

    @patch("api.routers.chat.ClaudeService")
    def test_extracts_filters_from_query(
        self, mock_service_cls, test_client: TestClient
    ):
        """Should return extracted filters from natural language."""
        mock_instance = MagicMock()
        mock_instance.extract_filters = AsyncMock(
            return_value={"min_curvature": 1000, "sources": ["vermont"]}
        )
        mock_service_cls.return_value = mock_instance

        response = test_client.post(
            "/chat/extract-filters?query=Find%20curvy%20roads%20in%20Vermont"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "Find curvy roads in Vermont"
        assert data["extracted_filters"]["min_curvature"] == 1000
        assert data["extracted_filters"]["sources"] == ["vermont"]

    def test_requires_query_parameter(self, test_client: TestClient):
        """Should return 422 when query param is missing."""
        response = test_client.post("/chat/extract-filters")
        assert response.status_code == 422

    @patch("api.routers.chat.ClaudeService")
    def test_returns_503_when_no_api_key(
        self, mock_service_cls, test_client: TestClient
    ):
        """Should return 503 when Claude service can't initialize."""
        mock_service_cls.side_effect = ValueError("ANTHROPIC_API_KEY not set")

        response = test_client.post(
            "/chat/extract-filters?query=Find%20roads"
        )
        assert response.status_code == 503

    @patch("api.routers.chat.ClaudeService")
    def test_returns_500_on_extraction_error(
        self, mock_service_cls, test_client: TestClient
    ):
        """Should return 500 when filter extraction fails."""
        mock_instance = MagicMock()
        mock_instance.extract_filters = AsyncMock(
            side_effect=RuntimeError("Unexpected error")
        )
        mock_service_cls.return_value = mock_instance

        response = test_client.post(
            "/chat/extract-filters?query=Find%20roads"
        )
        assert response.status_code == 500


class TestChatSearchEndpoint:
    """Tests for POST /chat/search"""

    @patch("api.routers.chat.ClaudeService")
    def test_full_search_flow(self, mock_service_cls, test_client: TestClient):
        """Should extract filters, query DB, and return GeoJSON results."""
        mock_instance = MagicMock()
        mock_instance.extract_filters = AsyncMock(
            return_value={"min_curvature": 1000, "sources": ["vermont"]}
        )
        mock_service_cls.return_value = mock_instance

        response = test_client.post(
            "/chat/search?query=Find%20curvy%20roads%20in%20Vermont&limit=10"
        )
        assert response.status_code == 200
        data = response.json()

        assert data["query"] == "Find curvy roads in Vermont"
        assert "filters" in data
        assert "results" in data
        assert "count" in data
        assert data["results"]["type"] == "FeatureCollection"

    @patch("api.routers.chat.ClaudeService")
    def test_search_returns_matching_segments(
        self, mock_service_cls, test_client: TestClient
    ):
        """Should return segments matching the extracted filters."""
        mock_instance = MagicMock()
        mock_instance.extract_filters = AsyncMock(
            return_value={"min_curvature": 2000, "sources": ["vermont"]}
        )
        mock_service_cls.return_value = mock_instance

        response = test_client.post(
            "/chat/search?query=Find%20very%20curvy%20roads%20in%20Vermont"
        )
        assert response.status_code == 200
        data = response.json()

        # Verify all returned segments meet min curvature
        for feature in data["results"]["features"]:
            assert feature["properties"]["curvature"] >= 2000

    @patch("api.routers.chat.ClaudeService")
    def test_search_respects_limit(
        self, mock_service_cls, test_client: TestClient
    ):
        """Should respect the limit parameter."""
        mock_instance = MagicMock()
        mock_instance.extract_filters = AsyncMock(
            return_value={"min_curvature": 300}
        )
        mock_service_cls.return_value = mock_instance

        response = test_client.post("/chat/search?query=Find%20roads&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]["features"]) <= 2

    @patch("api.routers.chat.ClaudeService")
    def test_search_empty_results(
        self, mock_service_cls, test_client: TestClient
    ):
        """Should handle queries that return no results gracefully."""
        mock_instance = MagicMock()
        mock_instance.extract_filters = AsyncMock(
            return_value={"min_curvature": 999999}
        )
        mock_service_cls.return_value = mock_instance

        response = test_client.post(
            "/chat/search?query=Find%20impossibly%20curvy%20roads"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["results"]["type"] == "FeatureCollection"
        assert data["results"]["features"] == []
        assert data["count"] == 0

    def test_search_requires_query(self, test_client: TestClient):
        """Should return 422 when query param is missing."""
        response = test_client.post("/chat/search")
        assert response.status_code == 422

    @patch("api.routers.chat.ClaudeService")
    def test_search_returns_503_without_api_key(
        self, mock_service_cls, test_client: TestClient
    ):
        """Should return 503 when Claude is unavailable."""
        mock_service_cls.side_effect = ValueError("ANTHROPIC_API_KEY not set")

        response = test_client.post(
            "/chat/search?query=Find%20roads"
        )
        assert response.status_code == 503

    def test_search_validates_limit_min(self, test_client: TestClient):
        """Should reject limit below 1."""
        response = test_client.post(
            "/chat/search?query=Find%20roads&limit=0"
        )
        assert response.status_code == 422

    def test_search_validates_limit_max(self, test_client: TestClient):
        """Should reject limit above 50."""
        response = test_client.post(
            "/chat/search?query=Find%20roads&limit=100"
        )
        assert response.status_code == 422

    @patch("api.routers.chat.ClaudeService")
    def test_search_returns_geojson_features_with_properties(
        self, mock_service_cls, test_client: TestClient
    ):
        """Should return features with expected property fields."""
        mock_instance = MagicMock()
        mock_instance.extract_filters = AsyncMock(
            return_value={"min_curvature": 1000, "sources": ["vermont"]}
        )
        mock_service_cls.return_value = mock_instance

        response = test_client.post(
            "/chat/search?query=Find%20curvy%20roads%20in%20Vermont&limit=1"
        )
        assert response.status_code == 200
        data = response.json()

        if data["results"]["features"]:
            feature = data["results"]["features"][0]
            assert feature["type"] == "Feature"
            assert "geometry" in feature
            props = feature["properties"]
            for key in [
                "id",
                "name",
                "curvature",
                "curvature_level",
                "length",
                "paved",
                "source",
            ]:
                assert key in props, f"Missing property: {key}"
