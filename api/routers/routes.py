"""
FastAPI router for route management endpoints.

Thin layer that delegates to route service for business logic.
"""

from fastapi import APIRouter, HTTPException, Query, Depends, Response
from sqlalchemy.orm import Session

from api.database import get_db_session
from api.models.schemas import (
    SaveRouteRequest,
    UpdateRouteRequest,
    RouteDetailResponse,
    RouteListResponse,
    SaveRouteResponse,
)
from api.services.route_service import RouteService
from api.services.export_service import ExportService

router = APIRouter(prefix="/routes", tags=["routes"])


def get_route_service(db: Session = Depends(get_db_session)) -> RouteService:
    """Dependency injection for route service"""
    return RouteService(db)


def get_export_service(db: Session = Depends(get_db_session)) -> ExportService:
    """Dependency injection for export service"""
    return ExportService(db)


@router.post("/save", response_model=SaveRouteResponse)
async def save_route(
    request: SaveRouteRequest,
    session_id: str = Query(..., description="Session ID"),
    service: RouteService = Depends(get_route_service),
):
    """Save a stitched route to the database"""
    try:
        return service.save_route(request, session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving route: {str(e)}")


@router.get("/list", response_model=RouteListResponse)
async def list_routes(
    session_id: str = Query(..., description="Session ID"),
    service: RouteService = Depends(get_route_service),
):
    """List all routes for a session"""
    try:
        return service.list_routes(session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{route_identifier}", response_model=RouteDetailResponse)
async def get_route(
    route_identifier: str, service: RouteService = Depends(get_route_service)
):
    """Get route details by ID or URL slug"""
    try:
        return service.get_route(route_identifier)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{route_id}")
async def update_route(
    route_id: int,
    request: UpdateRouteRequest,
    session_id: str = Query(..., description="Session ID"),
    service: RouteService = Depends(get_route_service),
):
    """Update route metadata"""
    try:
        return service.update_route(route_id, session_id, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{route_id}")
async def delete_route(
    route_id: int,
    session_id: str = Query(..., description="Session ID"),
    service: RouteService = Depends(get_route_service),
):
    """Delete a saved route"""
    try:
        return service.delete_route(route_id, session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{route_identifier}/export/gpx")
async def export_route_gpx(
    route_identifier: str, service: ExportService = Depends(get_export_service)
):
    """Export route as GPX file for GPS devices"""
    try:
        gpx_content, filename = service.export_gpx(route_identifier)
        return Response(
            content=gpx_content,
            media_type="application/gpx+xml",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{route_identifier}/export/kml")
async def export_route_kml(
    route_identifier: str, service: ExportService = Depends(get_export_service)
):
    """Export route as KML file for Google Earth"""
    try:
        kml_content, filename = service.export_kml(route_identifier)
        return Response(
            content=kml_content,
            media_type="application/vnd.google-earth.kml+xml",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
