"""
FastAPI router for chat/LLM-powered search endpoints.

Provides natural language search capabilities using Claude AI
to interpret user queries and find matching roads.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/health")
async def chat_health():
    """
    Health check endpoint for chat service.

    Returns status of the chat/LLM integration.
    """
    return {"status": "ok", "service": "chat"}
