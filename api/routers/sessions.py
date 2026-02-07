"""
FastAPI router for session management.

Provides anonymous session creation for route building.
Sessions allow users to save and manage routes without authentication.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.database import get_db_session
from api.repositories.session_repository import SessionRepository
from api.models.schemas import SessionResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse)
async def create_session(db: Session = Depends(get_db_session)):
    """
    Create a new anonymous session.

    Returns a session ID that should be stored client-side and passed
    as X-Session-Id header for route operations.
    """
    try:
        repo = SessionRepository(db)
        session = repo.create_session()
        return SessionResponse(
            session_id=str(session.session_id),
            created_at=session.created_at.isoformat(),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create session: {str(e)}",
        )
