"""
FastAPI router for chat/LLM-powered search endpoints.

Provides natural language search capabilities using Claude AI
to interpret user queries and find matching roads.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from api.services.claude_service import ClaudeService
from api.services.query_builder import CurvatureQueryBuilder

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


@router.post("/build-query")
async def build_query(
    min_curvature: Optional[int] = Query(None, description="Minimum curvature score"),
    max_curvature: Optional[int] = Query(None, description="Maximum curvature score"),
    min_length: Optional[float] = Query(None, description="Minimum length in miles"),
    max_length: Optional[float] = Query(None, description="Maximum length in miles"),
    curvature_level: Optional[str] = Query(
        None,
        description="Curvature level: mild, moderate, curvy, very_curvy, extreme, epic",
    ),
):
    """
    Test endpoint for query builder.

    Builds filter parameters from explicit values.
    """
    builder = CurvatureQueryBuilder()
    filters = builder.build_filters(
        min_curvature=min_curvature,
        max_curvature=max_curvature,
        min_length=min_length,
        max_length=max_length,
        curvature_level=curvature_level,
    )

    # Validate filters
    errors = builder.validate_filters(filters)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})

    return {"filters": filters}


@router.post("/extract-filters")
async def extract_filters(
    query: str = Query(
        ...,
        description="Natural language query about finding roads",
        example="Find super twisty roads in Vermont",
    ),
):
    """
    Extract search filters from natural language query.

    Uses Claude AI to parse the user's query and extract
    structured search parameters.
    """
    try:
        service = get_claude_service()
        filters = await service.extract_filters(query)
        return {"query": query, "extracted_filters": filters}
    except Exception as e:
        logger.error(f"Error extracting filters: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error extracting filters: {str(e)}"
        )
