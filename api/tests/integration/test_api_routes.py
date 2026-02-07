"""
Integration tests for FastAPI endpoints.

Tests all API routes including:
- Session management
- Route CRUD operations
- Search and filtering
- Error handling
"""

import pytest
import uuid
from fastapi.testclient import TestClient

from tests.fixtures.sample_segments import (
    CONNECTED_SEGMENTS,
    SAMPLE_ROUTE_METADATA,
    SAMPLE_PUBLIC_ROUTE_METADATA,
)


@pytest.mark.integration
class TestRootAndHealthEndpoints:
    """Tests for basic API endpoints."""

    def test_root_endpoint(self, test_client):
        """Test GET / returns API information."""
        response = test_client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "Curvature API" in data["name"]
        assert "endpoints" in data

    def test_health_check(self, test_client):
        """Test GET /health returns status."""
        response = test_client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "healthy"
        assert "database_available" in data


@pytest.mark.integration
class TestSessionManagement:
    """Tests for session creation and management."""

    def test_create_session(self, test_client):
        """Test POST /sessions creates a new anonymous session."""
        response = test_client.post("/sessions")

        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert "created_at" in data

        # Verify session_id is a valid UUID
        session_id = data["session_id"]
        uuid.UUID(session_id)  # Will raise if invalid

    def test_create_multiple_sessions(self, test_client):
        """Test that each POST /sessions creates a unique session."""
        response1 = test_client.post("/sessions")
        response2 = test_client.post("/sessions")

        assert response1.status_code == 200
        assert response2.status_code == 200

        id1 = response1.json()["session_id"]
        id2 = response2.json()["session_id"]
        assert id1 != id2


@pytest.mark.integration
class TestRouteCRUDOperations:
    """Tests for route create, read, update, delete operations."""

    def _create_session(self, test_client):
        """Helper to create a session and return its ID."""
        response = test_client.post("/sessions")
        return response.json()["session_id"]

    def test_save_route(self, test_client, sample_session):
        """Test POST /routes with valid segments."""
        payload = {
            "route_name": SAMPLE_ROUTE_METADATA["route_name"],
            "description": SAMPLE_ROUTE_METADATA["description"],
            "segments": CONNECTED_SEGMENTS,
            "is_public": False,
        }

        response = test_client.post(
            "/routes",
            json=payload,
            headers={"X-Session-Id": str(sample_session.session_id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "route_id" in data
        assert "url_slug" in data
        assert "share_url" in data

    def test_save_route_invalid_session(self, test_client):
        """Test POST /routes with invalid session ID returns 404."""
        fake_session_id = str(uuid.uuid4())
        payload = {
            "route_name": "Test Route",
            "segments": CONNECTED_SEGMENTS,
            "is_public": False,
        }

        response = test_client.post(
            "/routes",
            json=payload,
            headers={"X-Session-Id": fake_session_id},
        )

        assert response.status_code == 404
        assert "Session not found" in response.json()["detail"]

    def test_save_route_missing_session_header(self, test_client):
        """Test POST /routes without X-Session-Id header returns 422."""
        payload = {
            "route_name": "Test Route",
            "segments": CONNECTED_SEGMENTS,
            "is_public": False,
        }

        response = test_client.post("/routes", json=payload)

        assert response.status_code == 422

    def test_get_route_by_id(self, test_client, sample_route):
        """Test GET /routes/{id} returns route details."""
        response = test_client.get(f"/routes/{sample_route.route_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["route_id"] == sample_route.route_id
        assert data["route_name"] == sample_route.route_name
        assert "geojson" in data
        assert "segments" in data

    def test_get_route_not_found(self, test_client):
        """Test GET /routes/{id} with nonexistent route returns 404."""
        response = test_client.get("/routes/999999")

        assert response.status_code == 404
        assert "Route not found" in response.json()["detail"]

    def test_list_routes(self, test_client, sample_session, sample_route):
        """Test GET /routes returns user's routes."""
        response = test_client.get(
            "/routes",
            headers={"X-Session-Id": str(sample_session.session_id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert "routes" in data
        assert len(data["routes"]) > 0

        # Verify route structure
        route = data["routes"][0]
        assert "route_id" in route
        assert "route_name" in route
        assert "total_curvature" in route
        assert "total_length_km" in route
        assert "segment_count" in route

    def test_list_routes_empty_session(self, test_client):
        """Test GET /routes for session with no routes returns empty list."""
        session_id = self._create_session(test_client)

        response = test_client.get(
            "/routes",
            headers={"X-Session-Id": session_id},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["routes"] == []

    def test_update_route(self, test_client, sample_session, sample_route):
        """Test PUT /routes/{id} updates route metadata."""
        new_name = "Updated Route Name"
        new_description = "Updated description"

        response = test_client.put(
            f"/routes/{sample_route.route_id}",
            headers={"X-Session-Id": str(sample_session.session_id)},
            json={
                "route_name": new_name,
                "description": new_description,
                "is_public": True,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"

        # Verify update by fetching route
        get_response = test_client.get(f"/routes/{sample_route.route_id}")
        updated_route = get_response.json()
        assert updated_route["route_name"] == new_name
        assert updated_route["description"] == new_description
        assert updated_route["is_public"] is True

    def test_update_route_unauthorized(self, test_client, sample_route):
        """Test PUT /routes/{id} with wrong session returns 404."""
        wrong_session_id = str(uuid.uuid4())

        response = test_client.put(
            f"/routes/{sample_route.route_id}",
            headers={"X-Session-Id": wrong_session_id},
            json={"route_name": "Hacked Name"},
        )

        assert response.status_code == 404

    def test_delete_route(self, test_client, sample_session, sample_route):
        """Test DELETE /routes/{id} deletes route."""
        route_id = sample_route.route_id

        response = test_client.delete(
            f"/routes/{route_id}",
            headers={"X-Session-Id": str(sample_session.session_id)},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"

        # Verify deletion by trying to fetch
        get_response = test_client.get(f"/routes/{route_id}")
        assert get_response.status_code == 404

    def test_delete_route_unauthorized(self, test_client, sample_route):
        """Test DELETE /routes/{id} with wrong session returns 404."""
        wrong_session_id = str(uuid.uuid4())

        response = test_client.delete(
            f"/routes/{sample_route.route_id}",
            headers={"X-Session-Id": wrong_session_id},
        )

        assert response.status_code == 404


@pytest.mark.integration
class TestRouteDataValidation:
    """Tests for route data validation."""

    def test_save_route_calculates_statistics(self, test_client, sample_session):
        """Test that route statistics are calculated correctly."""
        payload = {
            "route_name": "Stats Test",
            "segments": CONNECTED_SEGMENTS,
            "is_public": False,
        }

        response = test_client.post(
            "/routes",
            json=payload,
            headers={"X-Session-Id": str(sample_session.session_id)},
        )

        assert response.status_code == 200
        route_id = response.json()["route_id"]

        # Get route details
        get_response = test_client.get(f"/routes/{route_id}")
        data = get_response.json()

        # Verify statistics
        expected_curvature = sum(seg["curvature"] for seg in CONNECTED_SEGMENTS)
        expected_length = sum(seg["length"] for seg in CONNECTED_SEGMENTS)

        assert data["total_curvature"] == pytest.approx(expected_curvature)
        assert data["total_length_km"] == pytest.approx(
            expected_length / 1000, rel=0.01
        )
        assert data["segment_count"] == len(CONNECTED_SEGMENTS)

    def test_save_route_preserves_segment_data(self, test_client, sample_session):
        """Test that all segment data is preserved in route_data JSONB."""
        payload = {
            "route_name": "Preservation Test",
            "segments": CONNECTED_SEGMENTS,
            "is_public": False,
        }

        response = test_client.post(
            "/routes",
            json=payload,
            headers={"X-Session-Id": str(sample_session.session_id)},
        )

        route_id = response.json()["route_id"]

        # Get route
        get_response = test_client.get(f"/routes/{route_id}")
        data = get_response.json()

        # Verify all segment data preserved
        assert len(data["segments"]) == len(CONNECTED_SEGMENTS)

        for i, seg in enumerate(data["segments"]):
            original = CONNECTED_SEGMENTS[i]
            assert seg["way_id"] == original["way_id"]
            assert seg["start"] == original["start"]
            assert seg["end"] == original["end"]
            assert seg["curvature"] == original["curvature"]

    def test_save_route_creates_geojson(self, test_client, sample_session):
        """Test that route GeoJSON is generated correctly."""
        payload = {
            "route_name": "GeoJSON Test",
            "segments": CONNECTED_SEGMENTS,
            "is_public": False,
        }

        response = test_client.post(
            "/routes",
            json=payload,
            headers={"X-Session-Id": str(sample_session.session_id)},
        )

        route_id = response.json()["route_id"]

        # Get route
        get_response = test_client.get(f"/routes/{route_id}")
        data = get_response.json()

        # Verify GeoJSON structure
        geojson = data["geojson"]
        assert geojson["type"] == "Feature"
        assert geojson["geometry"]["type"] == "LineString"
        assert len(geojson["geometry"]["coordinates"]) == 4  # 3 segments = 4 points

        # Verify coordinate format is [lon, lat]
        first_coord = geojson["geometry"]["coordinates"][0]
        assert len(first_coord) == 2
        # Longitude should be negative (Vermont is west)
        assert first_coord[0] < 0

    def test_missing_required_fields(self, test_client, sample_session):
        """Test that missing required fields returns validation error."""
        # Missing route_name
        payload = {"segments": CONNECTED_SEGMENTS}

        response = test_client.post(
            "/routes",
            json=payload,
            headers={"X-Session-Id": str(sample_session.session_id)},
        )

        assert response.status_code == 422  # Validation error


@pytest.mark.integration
class TestErrorHandling:
    """Tests for API error handling."""

    def test_invalid_route_id_format(self, test_client):
        """Test that invalid route ID format returns 422."""
        response = test_client.get("/routes/not-a-number")

        assert response.status_code == 422


@pytest.mark.integration
class TestPublicRoutes:
    """Tests for public route sharing."""

    def test_shared_route_accessible(self, test_client, sample_session):
        """Test that a public route is accessible via shared slug."""
        payload = {
            "route_name": SAMPLE_PUBLIC_ROUTE_METADATA["route_name"],
            "description": SAMPLE_PUBLIC_ROUTE_METADATA["description"],
            "segments": CONNECTED_SEGMENTS,
            "is_public": True,
        }

        response = test_client.post(
            "/routes",
            json=payload,
            headers={"X-Session-Id": str(sample_session.session_id)},
        )

        assert response.status_code == 200
        url_slug = response.json()["url_slug"]

        # Access via shared endpoint
        shared_response = test_client.get(f"/routes/shared/{url_slug}")
        assert shared_response.status_code == 200
        data = shared_response.json()
        assert data["is_public"] is True
        assert data["route_name"] == SAMPLE_PUBLIC_ROUTE_METADATA["route_name"]

    def test_private_route_not_shared(self, test_client, sample_route):
        """Test that a private route returns 404 on shared endpoint."""
        response = test_client.get(f"/routes/shared/{sample_route.url_slug}")

        assert response.status_code == 404

    def test_shared_nonexistent_slug(self, test_client):
        """Test that a nonexistent slug returns 404."""
        response = test_client.get("/routes/shared/does-not-exist")

        assert response.status_code == 404


@pytest.mark.integration
class TestURLSlugGeneration:
    """Tests for URL slug generation and uniqueness."""

    def test_url_slug_generated(self, test_client, sample_session):
        """Test that URL slug is automatically generated."""
        payload = {
            "route_name": "My Test Route",
            "segments": CONNECTED_SEGMENTS,
            "is_public": False,
        }

        response = test_client.post(
            "/routes",
            json=payload,
            headers={"X-Session-Id": str(sample_session.session_id)},
        )

        data = response.json()
        assert "url_slug" in data
        assert len(data["url_slug"]) > 0

        # Slug should be based on route name
        assert "my-test-route" in data["url_slug"]

    def test_url_slug_unique_for_same_name(self, test_client, sample_session):
        """Test that routes with same name get unique slugs."""
        payload = {
            "route_name": "Duplicate Name",
            "segments": CONNECTED_SEGMENTS,
            "is_public": False,
        }

        # Create first route
        response1 = test_client.post(
            "/routes",
            json=payload,
            headers={"X-Session-Id": str(sample_session.session_id)},
        )
        slug1 = response1.json()["url_slug"]

        # Create second route with same name
        response2 = test_client.post(
            "/routes",
            json=payload,
            headers={"X-Session-Id": str(sample_session.session_id)},
        )
        slug2 = response2.json()["url_slug"]

        # Slugs should be different (due to hash)
        assert slug1 != slug2


@pytest.mark.integration
class TestSessionIsolation:
    """Tests for session-based route isolation."""

    def test_multiple_sessions_isolated(self, test_client):
        """Test that routes from different sessions are isolated."""
        # Create two sessions
        session1_id = test_client.post("/sessions").json()["session_id"]
        session2_id = test_client.post("/sessions").json()["session_id"]

        # Create route for session1
        payload = {
            "route_name": "Session 1 Route",
            "segments": CONNECTED_SEGMENTS,
            "is_public": False,
        }
        test_client.post(
            "/routes",
            json=payload,
            headers={"X-Session-Id": session1_id},
        )

        # List routes for session2 (should be empty)
        response = test_client.get(
            "/routes",
            headers={"X-Session-Id": session2_id},
        )
        data = response.json()
        assert len(data["routes"]) == 0

        # List routes for session1 (should have 1)
        response = test_client.get(
            "/routes",
            headers={"X-Session-Id": session1_id},
        )
        data = response.json()
        assert len(data["routes"]) == 1
