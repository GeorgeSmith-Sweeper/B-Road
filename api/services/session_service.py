"""
Service for session operations.
"""

from typing import Optional
from sqlalchemy.orm import Session

from api.models.schemas import SessionResponse
from api.repositories.session_repository import SessionRepository


class SessionService:
    """Business logic for session operations."""

    def __init__(self, db: Session):
        self.db = db
        self.session_repo = SessionRepository(db)

    def create_session(self, session_name: Optional[str] = None) -> SessionResponse:
        """Create a new user session"""
        session = self.session_repo.create_session(session_name)

        return SessionResponse(
            session_id=str(session.session_id),
            created_at=session.created_at.isoformat(),
        )
