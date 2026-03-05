"""
FastAPI router for saved route endpoints.

Provides CRUD operations for user-created routes built by stitching
road segments together. Routes are scoped to anonymous sessions
(X-Session-Id header) or authenticated users (Authorization: Bearer token),
or both.
"""

from typing import Optional
from dataclasses import dataclass
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from api.database import get_db_session
from api.auth import get_optional_user_id
from api.services.route_service import RouteService
from api.services.export_service import ExportService
from api.models.schemas import (
    SaveRouteRequest,
    UpdateRouteRequest,
    ClaimRoutesRequest,
    ClaimRoutesResponse,
    RouteDetailResponse,
    RouteListResponse,
    SaveRouteResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/routes", tags=["routes"])


def get_route_service(db: Session = Depends(get_db_session)) -> RouteService:
    """Dependency injection for route service."""
    return RouteService(db)


def get_export_service(db: Session = Depends(get_db_session)) -> ExportService:
    """Dependency injection for export service."""
    return ExportService(db)


@dataclass
class AuthContext:
    """Authentication context from session and/or JWT."""

    session_id: Optional[str]
    user_id: Optional[str]


def get_auth_context(
    x_session_id: Optional[str] = Header(None),
    user_id: Optional[str] = Depends(get_optional_user_id),
) -> AuthContext:
    """Extract auth context from session header and/or Bearer token."""
    return AuthContext(session_id=x_session_id, user_id=user_id)



@router.post("", response_model=SaveRouteResponse)
async def save_route(
    request: SaveRouteRequest,
    auth: AuthContext = Depends(get_auth_context),
    service: RouteService = Depends(get_route_service),
):
    """
    Save a new route.

    Requires X-Session-Id header. If authenticated, the route is also
    associated with the user's account.
    """
    if not auth.session_id:
        raise HTTPException(status_code=400, detail="X-Session-Id header is required")
    try:
        return service.save_route(request, auth.session_id, user_id=auth.user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save route: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save route: {str(e)}",
        )


@router.get("", response_model=RouteListResponse)
async def list_routes(
    auth: AuthContext = Depends(get_auth_context),
    service: RouteService = Depends(get_route_service),
):
    """
    List routes for the current user or session.

    If authenticated, returns user's routes. Otherwise falls back to session routes.
    """
    try:
        if auth.user_id:
            return service.list_user_routes(auth.user_id)
        if auth.session_id:
            return service.list_routes(auth.session_id)
        raise HTTPException(
            status_code=400,
            detail="X-Session-Id header or Authorization token is required",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list routes: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list routes: {str(e)}",
        )


@router.post("/claim", response_model=ClaimRoutesResponse)
async def claim_routes(
    request: ClaimRoutesRequest,
    auth: AuthContext = Depends(get_auth_context),
    service: RouteService = Depends(get_route_service),
):
    """
    Claim anonymous session routes for the authenticated user.

    Requires Authorization: Bearer token. Transfers all unclaimed routes
    from the given session to the authenticated user.
    """
    if not auth.user_id:
        raise HTTPException(
            status_code=401,
            detail="Authentication required to claim routes",
        )
    try:
        result = service.claim_session_routes(request.session_id, auth.user_id)
        return ClaimRoutesResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to claim routes: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to claim routes: {str(e)}",
        )


@router.get("/public", response_model=RouteListResponse)
async def list_public_routes(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    service: RouteService = Depends(get_route_service),
):
    """
    List all public routes from all users.

    No session required — public routes are browsable by anyone.
    """
    try:
        return service.list_public_routes(limit, offset)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list public routes: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list public routes: {str(e)}",
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
        logger.error(f"Failed to get shared route: {type(e).__name__}: {e}")
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get route: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get route: {str(e)}",
        )


@router.put("/{route_id}")
async def update_route(
    route_id: int,
    request: UpdateRouteRequest,
    auth: AuthContext = Depends(get_auth_context),
    service: RouteService = Depends(get_route_service),
):
    """
    Update route metadata (name, description, public status).

    Authorized by session ID or user ID.
    """
    if not auth.session_id and not auth.user_id:
        raise HTTPException(
            status_code=400,
            detail="X-Session-Id header or Authorization token is required",
        )
    try:
        return service.update_route(
            route_id, auth.session_id, request, user_id=auth.user_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update route: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update route: {str(e)}",
        )


@router.delete("/{route_id}")
async def delete_route(
    route_id: int,
    auth: AuthContext = Depends(get_auth_context),
    service: RouteService = Depends(get_route_service),
):
    """
    Delete a saved route.

    Authorized by session ID or user ID.
    """
    if not auth.session_id and not auth.user_id:
        raise HTTPException(
            status_code=400,
            detail="X-Session-Id header or Authorization token is required",
        )
    try:
        return service.delete_route(route_id, auth.session_id, user_id=auth.user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete route: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete route: {str(e)}",
        )


@router.get("/shared/{slug}/export/gpx")
async def export_shared_route_gpx(
    slug: str,
    service: ExportService = Depends(get_export_service),
):
    """Export a public route as GPX file."""
    try:
        gpx_content, filename = service.export_gpx(slug)
        return Response(
            content=gpx_content,
            media_type="application/gpx+xml",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"GPX export failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/shared/{slug}/export/kml")
async def export_shared_route_kml(
    slug: str,
    service: ExportService = Depends(get_export_service),
):
    """Export a public route as KML file."""
    try:
        kml_content, filename = service.export_kml(slug)
        return Response(
            content=kml_content,
            media_type="application/vnd.google-earth.kml+xml",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"KML export failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
