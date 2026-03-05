"""
Repository for SavedRoute database operations.
"""

from typing import Optional, List
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import desc

from api.models.orm import SavedRoute
from api.repositories.base import BaseRepository


class RouteRepository(BaseRepository[SavedRoute]):
    """Repository for route CRUD operations."""

    def __init__(self, db: Session):
        super().__init__(SavedRoute, db)

    def get_by_id(self, route_id: int) -> Optional[SavedRoute]:
        """Get route by ID"""
        return self.db.query(SavedRoute).filter_by(route_id=route_id).first()

    def get_by_slug(self, url_slug: str) -> Optional[SavedRoute]:
        """Get route by URL slug"""
        return self.db.query(SavedRoute).filter_by(url_slug=url_slug).first()

    def get_by_id_or_slug(self, identifier: str) -> Optional[SavedRoute]:
        """Get route by ID (if numeric) or URL slug"""
        # Try slug first
        route = self.get_by_slug(identifier)
        if route:
            return route

        # Try as ID
        try:
            route_id = int(identifier)
            return self.get_by_id(route_id)
        except ValueError:
            return None

    def get_by_session(self, session_id: uuid.UUID) -> List[SavedRoute]:
        """Get all routes for a session, ordered by creation date"""
        return (
            self.db.query(SavedRoute)
            .filter_by(session_id=session_id)
            .order_by(desc(SavedRoute.created_at))
            .all()
        )

    def get_by_session_and_id(
        self, session_id: uuid.UUID, route_id: int
    ) -> Optional[SavedRoute]:
        """Get route by ID and session (for authorization)"""
        return (
            self.db.query(SavedRoute)
            .filter_by(route_id=route_id, session_id=session_id)
            .first()
        )

    def create_route(self, route: SavedRoute) -> SavedRoute:
        """Create a new route"""
        self.db.add(route)
        self.db.flush()
        return route

    def update_route(self, route: SavedRoute) -> SavedRoute:
        """Update an existing route"""
        self.db.flush()
        return route

    def get_public(self, limit: int = 50, offset: int = 0) -> List[SavedRoute]:
        """Get all public routes, ordered by creation date"""
        return (
            self.db.query(SavedRoute)
            .filter_by(is_public=True)
            .order_by(desc(SavedRoute.created_at))
            .offset(offset)
            .limit(limit)
            .all()
        )

    def get_by_user(self, user_id: str) -> List[SavedRoute]:
        """Get all routes for a user, ordered by creation date"""
        return (
            self.db.query(SavedRoute)
            .filter_by(user_id=user_id)
            .order_by(desc(SavedRoute.created_at))
            .all()
        )

    def get_by_user_and_id(
        self, user_id: str, route_id: int
    ) -> Optional[SavedRoute]:
        """Get route by ID and user_id (for authorization)"""
        return (
            self.db.query(SavedRoute)
            .filter_by(route_id=route_id, user_id=user_id)
            .first()
        )

    def claim_routes_from_session(
        self, session_id: uuid.UUID, user_id: str
    ) -> int:
        """Bulk update user_id on a session's unclaimed routes. Returns count."""
        count = (
            self.db.query(SavedRoute)
            .filter_by(session_id=session_id, user_id=None)
            .update({"user_id": user_id})
        )
        self.db.flush()
        return count

    def delete_route(self, route: SavedRoute) -> None:
        """Delete a route (cascades to segments)"""
        self.db.delete(route)
        self.db.flush()
