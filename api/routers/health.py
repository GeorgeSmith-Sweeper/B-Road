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
            "/docs": "Interactive API documentation"
        }
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
        "collections_count": len(data_service.road_collections) if data_service.data_loaded else 0,
        "database_available": DATABASE_AVAILABLE
    }


@router.get("/config")
async def get_config():
    """Get frontend configuration including API keys"""
    try:
        from api import config

        if not hasattr(config, 'GOOGLE_MAPS_API_KEY'):
            raise HTTPException(
                status_code=500,
                detail="Google Maps API key not configured"
            )

        return {
            "google_maps_api_key": config.GOOGLE_MAPS_API_KEY,
            "default_center": {
                "lat": 44.0,
                "lng": -72.7
            },
            "default_zoom": 8
        }
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="Configuration not found. Please create api/config.py from config.example.py"
        )
