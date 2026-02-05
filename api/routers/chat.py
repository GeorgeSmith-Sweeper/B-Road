"""
FastAPI router for chat/LLM-powered search endpoints.

Provides natural language search capabilities using Claude AI
to interpret user queries and find matching roads.
"""

import logging
from fastapi import APIRouter, HTTPException, Query

from api.services.claude_service import ClaudeService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


def get_claude_service() -> ClaudeService:
    """Get an instance of the Claude service."""
    try:
        return ClaudeService()
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/health")
async def chat_health():
    """
    Health check endpoint for chat service.

    Returns status of the chat/LLM integration.
    """
    try:
        service = ClaudeService()
        claude_available = service.is_available()
    except Exception:
        claude_available = False

    return {
        "status": "ok",
        "service": "chat",
        "claude_available": claude_available,
    }


@router.post("/test")
async def test_chat(
    message: str = Query(
        ...,
        description="Message to send to Claude",
        example="Hello, are you there?",
    ),
):
    """
    Test endpoint for Claude integration.

    Sends a simple message to Claude and returns the response.
    Use this to verify the API key is working.
    """
    try:
        service = get_claude_service()
        response = await service.send_message(message)
        return {"message": message, "response": response}
    except Exception as e:
        logger.error(f"Error in chat test: {e}")
        raise HTTPException(status_code=500, detail=f"Claude API error: {str(e)}")
