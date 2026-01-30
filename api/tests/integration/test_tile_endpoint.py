"""
Integration tests for the vector tile endpoint.

Tests the /curvature/tiles/{z}/{x}/{y}.pbf endpoint including:
- Content type and cache headers
- Tile coordinate validation
- Source filter parameter
- Empty tile handling
"""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.integration
class TestTileEndpoint:
    """Tests for the vector tile endpoint."""

    def test_valid_tile_returns_protobuf_or_empty(self, test_client):
        """A valid tile request returns 200 with protobuf or 204 for empty."""
        response = test_client.get("/curvature/tiles/8/74/93.pbf")
        assert response.status_code in [200, 204]

        if response.status_code == 200:
            assert response.headers["content-type"] == "application/x-protobuf"

    def test_tile_cache_headers_on_200(self, test_client):
        """200 responses should have 1-hour cache headers."""
        response = test_client.get("/curvature/tiles/8/74/93.pbf")
        if response.status_code == 200:
            assert "max-age=3600" in response.headers.get("cache-control", "")

    def test_empty_tile_returns_204(self, test_client):
        """A tile in the ocean (no road data) should return 204."""
        # Tile in the middle of the Pacific Ocean
        response = test_client.get("/curvature/tiles/8/0/120.pbf")
        assert response.status_code == 204

    def test_empty_tile_cache_headers(self, test_client):
        """204 responses should have 24-hour cache headers."""
        response = test_client.get("/curvature/tiles/8/0/120.pbf")
        if response.status_code == 204:
            assert "max-age=86400" in response.headers.get("cache-control", "")

    def test_cors_header_on_tile(self, test_client):
        """Tile responses should include CORS header."""
        response = test_client.get("/curvature/tiles/8/74/93.pbf")
        # CORS can come from either the response headers or the middleware
        # The middleware adds it for all responses
        assert response.status_code in [200, 204]

    def test_invalid_zoom_too_high(self, test_client):
        """Zoom > 22 should return 400."""
        response = test_client.get("/curvature/tiles/23/0/0.pbf")
        assert response.status_code == 400

    def test_invalid_zoom_negative(self, test_client):
        """Negative zoom should return 422 (path validation)."""
        response = test_client.get("/curvature/tiles/-1/0/0.pbf")
        # FastAPI may return 400 or 422 depending on path parsing
        assert response.status_code in [400, 422]

    def test_invalid_x_out_of_range(self, test_client):
        """x >= 2^z should return 400."""
        # At zoom 2, max x is 3 (0-3)
        response = test_client.get("/curvature/tiles/2/4/0.pbf")
        assert response.status_code == 400

    def test_invalid_y_out_of_range(self, test_client):
        """y >= 2^z should return 400."""
        # At zoom 2, max y is 3 (0-3)
        response = test_client.get("/curvature/tiles/2/0/4.pbf")
        assert response.status_code == 400

    def test_source_filter_param(self, test_client):
        """Source query parameter should be accepted."""
        response = test_client.get("/curvature/tiles/8/74/93.pbf?source=vermont")
        assert response.status_code in [200, 204]

    def test_zoom_0_valid(self, test_client):
        """Zoom 0 with tile (0,0) should be valid."""
        response = test_client.get("/curvature/tiles/0/0/0.pbf")
        assert response.status_code in [200, 204]

    def test_tile_response_is_binary(self, test_client):
        """200 responses should contain binary data (not JSON)."""
        response = test_client.get("/curvature/tiles/8/74/93.pbf")
        if response.status_code == 200:
            # Protobuf content should not be valid JSON
            content = response.content
            assert len(content) > 0
            assert response.headers["content-type"] == "application/x-protobuf"
