"""
FastAPI router for vector tile endpoints.

Serves Mapbox Vector Tiles (MVT) from PostGIS via ST_AsMVT for efficient
map rendering of curvature data across all US states.
"""

from fastapi import APIRouter, HTTPException, Query, Depends, Response
from sqlalchemy.orm import Session
from typing import Optional

from api.database import get_db_session
from api.services.curvature_service import CurvatureService

router = APIRouter(prefix="/curvature/tiles", tags=["tiles"])


def get_curvature_service(db: Session = Depends(get_db_session)) -> CurvatureService:
    """Dependency injection for curvature service."""
    return CurvatureService(db)


@router.get("/{z}/{x}/{y}.pbf")
async def get_tile(
    z: int,
    x: int,
    y: int,
    source: Optional[str] = Query(
        None,
        description="Filter to segments from a specific source (e.g., 'vermont')",
    ),
    service: CurvatureService = Depends(get_curvature_service),
):
    """
    Get a Mapbox Vector Tile for the given ZXY coordinates.

    Returns a protobuf-encoded vector tile containing curvature segments.
    Zoom-based curvature filtering is applied automatically:
    - z < 8: only curvature >= 1000
    - z 8-10: only curvature >= 500
    - z > 10: curvature >= 300

    Tiles are cacheable for 1 hour (3600s). Empty tiles return 204 with 24h cache.
    """
    # Validate zoom level
    if z < 0 or z > 22:
        raise HTTPException(status_code=400, detail="Zoom level must be 0-22")

    # Validate tile coordinates within zoom bounds
    max_coord = 2 ** z
    if x < 0 or x >= max_coord:
        raise HTTPException(
            status_code=400,
            detail=f"x must be 0-{max_coord - 1} at zoom {z}",
        )
    if y < 0 or y >= max_coord:
        raise HTTPException(
            status_code=400,
            detail=f"y must be 0-{max_coord - 1} at zoom {z}",
        )

    # Zoom-based curvature filtering
    if z < 8:
        min_curvature = 1000
    elif z <= 10:
        min_curvature = 500
    else:
        min_curvature = 300

    try:
        tile_data = service.get_vector_tile(
            z=z,
            x=x,
            y=y,
            min_curvature=min_curvature,
            source=source,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating tile: {str(e)}",
        )

    if tile_data is None:
        return Response(
            status_code=204,
            headers={
                "Cache-Control": "public, max-age=86400",
                "Access-Control-Allow-Origin": "*",
            },
        )

    return Response(
        content=tile_data,
        media_type="application/x-protobuf",
        headers={
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
        },
    )
