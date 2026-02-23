"""
FastAPI router for chat/LLM-powered search endpoints.

Provides natural language search capabilities using Claude AI
to interpret user queries and find matching roads.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.orm import Session

from api.database import get_db_session
from api.models.schemas import ChatSearchRequest
from api.services.claude_service import ClaudeService
from api.services.curvature_service import CurvatureService
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
    except HTTPException:
        raise
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
        description="Curvature level: relaxed, spirited, engaging, technical, expert, legendary",
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting filters: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error extracting filters: {str(e)}"
        )


@router.post("/search")
async def chat_search(
    request: ChatSearchRequest,
    db: Session = Depends(get_db_session),
):
    """
    Natural language road search with conversational responses.

    This endpoint:
    1. Uses Claude AI to extract search filters from natural language
    2. Queries the curvature database with those filters
    3. Generates a conversational response describing the results
    4. Returns matching road segments as GeoJSON with the response

    Supports conversation history for follow-up queries like
    "show me shorter ones" or "any in New Hampshire?".

    Example queries:
    - "Find super twisty roads in Vermont"
    - "Show me epic paved mountain roads"
    - "What are the curviest roads over 10 miles long?"
    """
    try:
        # Convert history to list of dicts for the service
        history = [
            {"role": msg.role, "content": msg.content}
            for msg in request.history
        ]

        # Extract filters from natural language (with history for context)
        claude_service = get_claude_service()
        extracted_filters = await claude_service.extract_filters(
            request.query, history=history if history else None
        )

        # Build the database-ready filters
        builder = CurvatureQueryBuilder()
        db_filters = builder.build_filters(
            min_curvature=extracted_filters.get("min_curvature"),
            max_curvature=extracted_filters.get("max_curvature"),
            min_length=extracted_filters.get("min_length"),
            max_length=extracted_filters.get("max_length"),
            surface_types=extracted_filters.get("surface_types"),
            sources=extracted_filters.get("sources"),
            location=extracted_filters.get("location"),
        )

        # Query the database
        curvature_service = CurvatureService(db)
        results = curvature_service.search_by_filters(db_filters, request.limit)

        # Generate conversational response
        response_text = ""
        try:
            response_text = await claude_service.generate_response(
                request.query, results, history=history if history else None
            )
        except Exception as e:
            logger.warning(f"Response generation failed, using fallback: {e}")
            response_text = ""

        return {
            "query": request.query,
            "filters": extracted_filters,
            "results": results,
            "count": results.get("metadata", {}).get("count", 0),
            "response": response_text,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat search: {e}")
        raise HTTPException(
            status_code=500, detail=f"Search error: {str(e)}"
        )
