"""
FastAPI router for curvature data browsing.

Handles msgpack data loading and road/segment queries.
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from typing import Optional

from api.services.data_service import DataService
from api.services.geometry_service import GeometryService

router = APIRouter(tags=["data"])

# Module-level singletons (data loaded into memory)
data_service = DataService()
geometry_service = GeometryService()


@router.post("/data/load")
async def load_data(filepath: str):
    """Load a msgpack data file into memory"""
    try:
        return data_service.load_msgpack_file(filepath)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading data: {str(e)}")


@router.get("/roads/geojson")
async def get_roads_geojson(
    min_curvature: Optional[float] = Query(300),
    max_curvature: Optional[float] = Query(None),
    surface: Optional[str] = Query(None),
    limit: Optional[int] = Query(100),
):
    """Get roads as GeoJSON FeatureCollection"""
    try:
        collections = data_service.get_filtered_collections(
            min_curvature=min_curvature,
            max_curvature=max_curvature,
            surface=surface,
            limit=limit,
        )

        geojson = geometry_service.collections_to_geojson(
            collections,
            metadata={
                "total_collections": len(data_service.road_collections),
                "filtered_count": len(collections),
                "filters": {
                    "min_curvature": min_curvature,
                    "max_curvature": max_curvature,
                    "surface": surface,
                    "limit": limit,
                },
            },
        )

        return JSONResponse(content=geojson)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/roads")
async def search_roads(
    min_curvature: Optional[float] = Query(300), limit: Optional[int] = Query(20)
):
    """Search for roads and return as simple JSON"""
    try:
        collections = data_service.get_filtered_collections(
            min_curvature=min_curvature, limit=limit
        )

        results = []
        for collection in collections:
            results.append(
                {
                    "name": data_service.tools.get_collection_name(collection),
                    "curvature": round(
                        data_service.tools.get_collection_curvature(collection), 2
                    ),
                    "length_km": round(
                        data_service.tools.get_collection_length(collection) / 1000, 2
                    ),
                    "length_mi": round(
                        data_service.tools.get_collection_length(collection) / 1609, 2
                    ),
                    "surface": data_service.tools.get_collection_paved_style(
                        collection
                    ),
                }
            )

        return {"total_found": len(results), "roads": results}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/roads/segments")
async def get_road_segments(
    min_curvature: Optional[float] = Query(300),
    bbox: Optional[str] = Query(None),
    limit: Optional[int] = Query(500),
):
    """Get individual road segments for stitching mode"""
    try:
        segments = data_service.get_segments(
            min_curvature=min_curvature, bbox=bbox, limit=limit
        )

        geojson = geometry_service.segments_to_geojson(segments)

        return JSONResponse(content=geojson)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
