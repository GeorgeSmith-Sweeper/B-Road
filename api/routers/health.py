"""
FastAPI router for health and status endpoints.
"""

from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["health"])


@router.get("/")
async def root():
    """Root endpoint - returns API info"""
    return {
        "name": "Curvature API",
        "version": "1.0.0",
        "endpoints": {
            "/routes": "Search for roads",
            "/roads/geojson": "Get roads as GeoJSON",
            "/config": "Get frontend configuration",
            "/docs": "Interactive API documentation",
        },
    }


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    # Import here to avoid circular dependency
    from api.routers.data import data_service
    from api.database import DATABASE_AVAILABLE

    return {
        "status": "healthy",
        "data_loaded": data_service.data_loaded,
        "collections_count": (
            len(data_service.road_collections) if data_service.data_loaded else 0
        ),
        "database_available": DATABASE_AVAILABLE,
    }


@router.get("/config")
async def get_config():
    """Get frontend configuration including API keys"""
    import os

    # Try to get Mapbox token from environment or config file
    mapbox_token = os.getenv("MAPBOX_ACCESS_TOKEN", "")

    if not mapbox_token:
        try:
            from api import config
            mapbox_token = getattr(config, "MAPBOX_ACCESS_TOKEN", "")
        except ImportError:
            pass

    if not mapbox_token:
        raise HTTPException(
            status_code=500,
            detail="Mapbox API token not configured. Set MAPBOX_ACCESS_TOKEN environment variable.",
        )

    return {
        "mapbox_api_key": mapbox_token,
        "default_center": {"lat": 44.0, "lng": -72.7},
        "default_zoom": 8,
    }
