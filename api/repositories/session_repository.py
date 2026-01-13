"""
Repository for RouteSession database operations.
"""

from typing import Optional
import uuid
from sqlalchemy.orm import Session

from api.models.orm import RouteSession
from api.repositories.base import BaseRepository


class SessionRepository(BaseRepository[RouteSession]):
    """Repository for session operations."""

    def __init__(self, db: Session):
        super().__init__(RouteSession, db)

    def get_by_id(self, session_id: uuid.UUID) -> Optional[RouteSession]:
        """Get session by UUID"""
        return self.db.query(RouteSession).filter_by(session_id=session_id).first()

    def create_session(self, session_name: Optional[str] = None) -> RouteSession:
        """Create new session"""
        session = RouteSession(session_name=session_name)
        self.db.add(session)
        self.db.flush()
        return session
