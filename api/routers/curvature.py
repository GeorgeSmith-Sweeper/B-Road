"""
FastAPI router for curvature segment endpoints.

Provides endpoints for querying curvature data loaded by the curvature
processing pipeline from OSM data.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.orm import Session
from typing import Optional, List

from api.database import get_db_session
from api.services.curvature_service import CurvatureService

router = APIRouter(prefix="/curvature", tags=["curvature"])


def get_curvature_service(db: Session = Depends(get_db_session)) -> CurvatureService:
    """Dependency injection for curvature service"""
    return CurvatureService(db)


@router.get("/segments")
async def get_segments(
    bbox: str = Query(
        ...,
        description="Bounding box as 'west,south,east,north' in WGS84 coordinates",
        example="-73.5,42.7,-71.5,45.0",
    ),
    min_curvature: int = Query(
        300,
        ge=0,
        description="Minimum curvature score to include",
    ),
    limit: int = Query(
        1000,
        ge=1,
        le=5000,
        description="Maximum number of segments to return",
    ),
    source: Optional[str] = Query(
        None,
        description="Filter to segments from a specific source (e.g., 'vermont')",
    ),
    service: CurvatureService = Depends(get_curvature_service),
):
    """
    Get curvature segments within a bounding box.

    Returns a GeoJSON FeatureCollection of road segments with curvature data.
    Segments are ordered by curvature descending (curviest roads first).

    Use zoom-based filtering for optimal performance:
    - zoom < 8: min_curvature=1000, limit=500
    - zoom 8-10: min_curvature=500, limit=1000
    - zoom > 10: min_curvature=300, limit=2000
    """
    try:
        # Parse bounding box
        parts = bbox.split(",")
        if len(parts) != 4:
            raise HTTPException(
                status_code=400,
                detail="bbox must be 'west,south,east,north'",
            )

        try:
            west = float(parts[0])
            south = float(parts[1])
            east = float(parts[2])
            north = float(parts[3])
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="bbox values must be valid numbers",
            )

        # Validate bounds
        if west >= east:
            raise HTTPException(
                status_code=400,
                detail="west must be less than east",
            )
        if south >= north:
            raise HTTPException(
                status_code=400,
                detail="south must be less than north",
            )

        return service.get_segments_geojson(
            west=west,
            south=south,
            east=east,
            north=north,
            min_curvature=min_curvature,
            limit=limit,
            source=source,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching segments: {str(e)}",
        )


@router.get("/sources")
async def list_sources(
    service: CurvatureService = Depends(get_curvature_service),
) -> List[dict]:
    """
    List all available data sources.

    Returns a list of sources (typically US states) with segment counts.
    Use this to populate source selector UI and show data availability.
    """
    try:
        return service.list_sources()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error listing sources: {str(e)}",
        )


@router.get("/sources/{source_name}/segments")
async def get_source_segments(
    source_name: str,
    min_curvature: int = Query(
        300,
        ge=0,
        description="Minimum curvature score to include",
    ),
    limit: int = Query(
        1000,
        ge=1,
        le=5000,
        description="Maximum number of segments to return",
    ),
    service: CurvatureService = Depends(get_curvature_service),
):
    """
    Get all segments for a specific source.

    Useful for loading an entire state's data without bbox filtering.
    """
    try:
        return service.get_segments_by_source_geojson(
            source_name=source_name,
            min_curvature=min_curvature,
            limit=limit,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching segments for source: {str(e)}",
        )


@router.get("/sources/{source_name}/bounds")
async def get_source_bounds(
    source_name: str,
    service: CurvatureService = Depends(get_curvature_service),
):
    """
    Get the bounding box for a source.

    Returns the extent of all segments from this source.
    Useful for centering/zooming the map to a state.
    """
    try:
        bounds = service.get_source_bounds(source_name)
        if bounds is None:
            raise HTTPException(
                status_code=404,
                detail=f"Source '{source_name}' not found or has no segments",
            )
        return bounds
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching bounds: {str(e)}",
        )


@router.get("/segments/{segment_id}")
async def get_segment_detail(
    segment_id: int,
    service: CurvatureService = Depends(get_curvature_service),
):
    """
    Get detailed information about a single segment.

    Returns segment data including the constituent OSM ways and their tags.
    """
    try:
        segment = service.get_segment_detail(segment_id)
        if segment is None:
            raise HTTPException(
                status_code=404,
                detail=f"Segment {segment_id} not found",
            )
        return segment
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching segment: {str(e)}",
        )
