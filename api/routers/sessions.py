"""
FastAPI router for session management.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from sqlalchemy.orm import Session

from api.database import get_db_session
from api.models.schemas import SessionResponse
from api.services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["sessions"])


def get_session_service(db: Session = Depends(get_db_session)) -> SessionService:
    """Dependency injection for session service"""
    return SessionService(db)


@router.post("/create", response_model=SessionResponse)
async def create_session(
    session_name: Optional[str] = None,
    service: SessionService = Depends(get_session_service),
):
    """Create a new user session for route building"""
    try:
        return service.create_session(session_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
