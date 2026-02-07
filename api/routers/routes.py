"""
FastAPI router for saved route endpoints.

Provides CRUD operations for user-created routes built by stitching
road segments together. Routes are scoped to anonymous sessions
identified by X-Session-Id header.
"""

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from api.database import get_db_session
from api.services.route_service import RouteService
from api.models.schemas import (
    SaveRouteRequest,
    UpdateRouteRequest,
    RouteDetailResponse,
    RouteListResponse,
    SaveRouteResponse,
)

router = APIRouter(prefix="/routes", tags=["routes"])


def get_route_service(db: Session = Depends(get_db_session)) -> RouteService:
    """Dependency injection for route service."""
    return RouteService(db)


def require_session_id(x_session_id: str = Header(...)) -> str:
    """Extract and validate the X-Session-Id header."""
    if not x_session_id:
        raise HTTPException(status_code=400, detail="X-Session-Id header is required")
    return x_session_id


@router.post("", response_model=SaveRouteResponse)
async def save_route(
    request: SaveRouteRequest,
    session_id: str = Depends(require_session_id),
    service: RouteService = Depends(get_route_service),
):
    """
    Save a new route.

    Requires X-Session-Id header. The route is associated with
    the session and can only be modified/deleted by the same session.
    """
    try:
        return service.save_route(request, session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save route: {str(e)}",
        )


@router.get("", response_model=RouteListResponse)
async def list_routes(
    session_id: str = Depends(require_session_id),
    service: RouteService = Depends(get_route_service),
):
    """
    List all routes for the current session.

    Requires X-Session-Id header.
    """
    try:
        return service.list_routes(session_id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list routes: {str(e)}",
        )


@router.get("/shared/{slug}", response_model=RouteDetailResponse)
async def get_shared_route(
    slug: str,
    service: RouteService = Depends(get_route_service),
):
    """
    Get a public route by its URL slug.

    No session required - public routes are accessible to anyone.
    """
    try:
        route = service.get_route(slug)
        if not route.is_public:
            raise HTTPException(status_code=404, detail="Route not found")
        return route
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get route: {str(e)}",
        )


@router.get("/{route_id}", response_model=RouteDetailResponse)
async def get_route(
    route_id: int,
    service: RouteService = Depends(get_route_service),
):
    """
    Get route details by ID.

    Returns full route data including GeoJSON geometry and segments.
    """
    try:
        return service.get_route(str(route_id))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get route: {str(e)}",
        )


@router.put("/{route_id}")
async def update_route(
    route_id: int,
    request: UpdateRouteRequest,
    session_id: str = Depends(require_session_id),
    service: RouteService = Depends(get_route_service),
):
    """
    Update route metadata (name, description, public status).

    Requires X-Session-Id header matching the route's session.
    """
    try:
        return service.update_route(route_id, session_id, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update route: {str(e)}",
        )


@router.delete("/{route_id}")
async def delete_route(
    route_id: int,
    session_id: str = Depends(require_session_id),
    service: RouteService = Depends(get_route_service),
):
    """
    Delete a saved route.

    Requires X-Session-Id header matching the route's session.
    Cascades to delete all associated segments.
    """
    try:
        return service.delete_route(route_id, session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete route: {str(e)}",
        )
