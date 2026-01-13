#!/usr/bin/env python
# -*- coding: UTF-8 -*-
"""
Curvature API Server
====================
A FastAPI-based REST API for querying curvature road data.

This server provides endpoints to:
- Search for curvy roads by various criteria
- Return GeoJSON for map visualization
- Serve the web interface

Author: George Smith-Sweeper (contribution to adamfranco/curvature)
"""

import os
import sys
import json
from typing import Optional, List
from pathlib import Path
from datetime import datetime
import hashlib
import uuid

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import msgpack
import gpxpy
import gpxpy.gpx
from shapely.geometry import LineString
from geoalchemy2.shape import from_shape

# Add parent directory to path to import curvature modules
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from curvature.output import OutputTools

# Import configuration (API keys, etc.)
try:
    from api import config
    GOOGLE_MAPS_API_KEY = config.GOOGLE_MAPS_API_KEY
except ImportError:
    GOOGLE_MAPS_API_KEY = None
    print("Warning: api/config.py not found. Please copy config.example.py to config.py and add your API keys.")

# Import database and models for saved routes feature
try:
    from api.database import get_db
    from api.models import RouteSession, SavedRoute, RouteSegment
    from api.export_service import generate_gpx_for_route, generate_kml_for_route
    DATABASE_AVAILABLE = True
except ImportError as e:
    DATABASE_AVAILABLE = False
    print(f"Warning: Database not available: {e}")
    print("Saved routes feature will be disabled. Install requirements: pip install -r api/requirements.txt")

# Initialize FastAPI app
app = FastAPI(
    title="Curvature API",
    description="API for finding and exploring curvy roads",
    version="1.0.0"
)

# Enable CORS so web browsers can access the API
# CORS = Cross-Origin Resource Sharing - allows JavaScript from your web page to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize output tools (provides utility methods for working with collections)
tools = OutputTools('km')

# Global variable to store loaded road data
# In a production app, you'd use a database, but for now we'll load from msgpack files
road_collections = []
data_loaded = False


def load_msgpack_file(filepath: str) -> List[dict]:
    """
    Load a curvature msgpack file and return the road collections.

    Args:
        filepath: Path to the .msgpack file

    Returns:
        List of road collection dictionaries

    Explanation:
        - msgpack is a binary format (like JSON but more compact)
        - Unpacker reads the file piece by piece (streaming)
        - Each item is a 'collection' - a group of connected road segments
    """
    collections = []

    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Data file not found: {filepath}")

    with open(filepath, 'rb') as f:
        # Create an unpacker that reads from the file
        # use_list=True means arrays become Python lists (not tuples)
        # raw=False means byte strings are decoded to Python strings
        unpacker = msgpack.Unpacker(f, use_list=True, raw=False, strict_map_key=False)

        # Iterate over each collection in the msgpack stream
        for collection in unpacker:
            collections.append(collection)

    return collections


def collection_to_geojson_feature(collection: dict) -> dict:
    """
    Convert a curvature collection to a GeoJSON Feature.

    Args:
        collection: A road collection from curvature

    Returns:
        A GeoJSON Feature dictionary

    Explanation:
        GeoJSON is a standard format for geographic data that maps understand.
        A Feature has:
        - geometry: the shape (LineString = a line)
        - properties: metadata (name, curvature score, etc.)
    """
    # Build the line coordinates from all segments in all ways
    coords = []

    for way in collection['ways']:
        # Check if this way has been processed with segments
        if 'segments' in way and len(way['segments']) > 0:
            # Add the starting point of the first segment
            first_segment = way['segments'][0]
            coords.append([first_segment['start'][1], first_segment['start'][0]])  # [lon, lat]

            # Add all endpoint coordinates
            for segment in way['segments']:
                coords.append([segment['end'][1], segment['end'][0]])  # [lon, lat]

    # Calculate useful properties using the OutputTools
    curvature = tools.get_collection_curvature(collection)
    length = tools.get_collection_length(collection)
    name = tools.get_collection_name(collection)
    surface = tools.get_collection_paved_style(collection)

    # Build the GeoJSON Feature
    feature = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": coords
        },
        "properties": {
            "name": name,
            "curvature": round(curvature, 2),
            "length_km": round(length / 1000, 2),
            "length_mi": round(length / 1609, 2),
            "surface": surface,
            "join_type": collection.get('join_type', 'none'),
        }
    }

    return feature


# Pydantic Models for Request/Response Validation
# ================================================

class SegmentData(BaseModel):
    """Segment data for saving routes"""
    way_id: int
    start: List[float]
    end: List[float]
    length: float
    radius: float
    curvature: float
    curvature_level: int
    name: Optional[str] = None
    highway: Optional[str] = None
    surface: Optional[str] = None


class SaveRouteRequest(BaseModel):
    """Request body for saving a route"""
    route_name: str
    description: Optional[str] = None
    segments: List[SegmentData]
    is_public: bool = False


class RouteResponse(BaseModel):
    """Response for route queries"""
    route_id: int
    route_name: str
    description: Optional[str]
    total_curvature: float
    total_length: float
    segment_count: int
    url_slug: str
    created_at: str
    is_public: bool


# API Endpoints
# =============

@app.get("/")
async def root():
    """
    Root endpoint - returns API info.
    """
    return {
        "name": "Curvature API",
        "version": "1.0.0",
        "endpoints": {
            "/roads": "Search for roads",
            "/roads/geojson": "Get roads as GeoJSON",
            "/config": "Get frontend configuration",
            "/docs": "Interactive API documentation"
        }
    }


@app.get("/config")
async def get_config():
    """
    Get frontend configuration including API keys.

    This endpoint serves configuration to the frontend in a secure way.
    The actual API keys are stored in api/config.py which is gitignored.

    Returns:
        Configuration object with Google Maps API key and other settings
    """
    if GOOGLE_MAPS_API_KEY is None:
        raise HTTPException(
            status_code=500,
            detail="Google Maps API key not configured. Please create api/config.py from api/config.example.py"
        )

    return {
        "google_maps_api_key": GOOGLE_MAPS_API_KEY,
        "default_center": {
            "lat": 44.0,
            "lng": -72.7
        },
        "default_zoom": 8
    }


@app.post("/data/load")
async def load_data(filepath: str):
    """
    Load a msgpack data file into memory.

    Args:
        filepath: Path to the .msgpack file to load

    Example:
        POST /data/load?filepath=/tmp/vermont.msgpack
    """
    global road_collections, data_loaded

    try:
        road_collections = load_msgpack_file(filepath)
        data_loaded = True
        return {
            "status": "success",
            "message": f"Loaded {len(road_collections)} road collections",
            "filepath": filepath
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading data: {str(e)}")


@app.get("/roads/geojson")
async def get_roads_geojson(
    min_curvature: Optional[float] = Query(300, description="Minimum curvature score"),
    max_curvature: Optional[float] = Query(None, description="Maximum curvature score"),
    surface: Optional[str] = Query(None, description="Surface type: paved, unpaved, or unknown"),
    limit: Optional[int] = Query(100, description="Maximum number of roads to return")
):
    """
    Get roads as GeoJSON FeatureCollection.

    Query parameters let you filter results:
    - min_curvature: Only roads curvier than this (default: 300)
    - max_curvature: Only roads less curvy than this
    - surface: Filter by surface type
    - limit: Max number of results (default: 100)

    Returns:
        GeoJSON FeatureCollection that can be directly loaded into maps

    Example:
        GET /roads/geojson?min_curvature=1000&surface=paved&limit=50
    """
    if not data_loaded:
        raise HTTPException(
            status_code=400,
            detail="No data loaded. Please POST to /data/load first."
        )

    # Filter collections based on criteria
    filtered = []

    for collection in road_collections:
        # Calculate curvature for this collection
        curvature = tools.get_collection_curvature(collection)

        # Apply filters
        if curvature < min_curvature:
            continue

        if max_curvature and curvature > max_curvature:
            continue

        if surface:
            collection_surface = tools.get_collection_paved_style(collection)
            if collection_surface != surface:
                continue

        # Passed all filters - add to results
        filtered.append(collection)

        # Check limit
        if len(filtered) >= limit:
            break

    # Convert to GeoJSON features
    features = []
    for collection in filtered:
        try:
            feature = collection_to_geojson_feature(collection)
            features.append(feature)
        except Exception as e:
            # Skip collections that can't be converted (e.g., no segments)
            continue

    # Build GeoJSON FeatureCollection
    geojson = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "total_collections": len(road_collections),
            "filtered_count": len(features),
            "filters": {
                "min_curvature": min_curvature,
                "max_curvature": max_curvature,
                "surface": surface,
                "limit": limit
            }
        }
    }

    return JSONResponse(content=geojson)


@app.get("/roads")
async def search_roads(
    min_curvature: Optional[float] = Query(300, description="Minimum curvature score"),
    limit: Optional[int] = Query(20, description="Maximum number of roads to return")
):
    """
    Search for roads and return as simple JSON (not GeoJSON).

    Useful for getting a quick list without the full geometry.

    Returns:
        List of road objects with name, curvature, length
    """
    if not data_loaded:
        raise HTTPException(
            status_code=400,
            detail="No data loaded. Please POST to /data/load first."
        )

    results = []

    for collection in road_collections:
        curvature = tools.get_collection_curvature(collection)

        if curvature < min_curvature:
            continue

        results.append({
            "name": tools.get_collection_name(collection),
            "curvature": round(curvature, 2),
            "length_km": round(tools.get_collection_length(collection) / 1000, 2),
            "length_mi": round(tools.get_collection_length(collection) / 1609, 2),
            "surface": tools.get_collection_paved_style(collection)
        })

        if len(results) >= limit:
            break

    return {
        "total_found": len(results),
        "roads": results
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint - useful for monitoring.
    """
    return {
        "status": "healthy",
        "data_loaded": data_loaded,
        "collections_count": len(road_collections) if data_loaded else 0,
        "database_available": DATABASE_AVAILABLE
    }


# New Endpoints for Route Stitching and Saving
# =============================================

@app.post("/sessions/create")
async def create_session(session_name: Optional[str] = None):
    """
    Create a new user session for route building.

    Returns:
        Session ID and creation timestamp
    """
    if not DATABASE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")

    with get_db() as db:
        session = RouteSession(session_name=session_name)
        db.add(session)
        db.commit()
        db.refresh(session)

        return {
            "session_id": str(session.session_id),
            "created_at": session.created_at.isoformat()
        }


@app.get("/roads/segments")
async def get_road_segments(
    min_curvature: Optional[float] = Query(300, description="Minimum curvature for parent collection"),
    bbox: Optional[str] = Query(None, description="Bounding box: min_lon,min_lat,max_lon,max_lat"),
    limit: Optional[int] = Query(500, description="Maximum number of segments to return")
):
    """
    Get individual road segments (not collections) for stitching mode.

    Returns each segment as a separate GeoJSON feature with full details.
    This is more granular than /roads/geojson which returns collections.

    Args:
        min_curvature: Minimum curvature of parent collection
        bbox: Bounding box filter (optional, for visible area only)
        limit: Maximum segments to return

    Returns:
        GeoJSON FeatureCollection with individual segments
    """
    if not data_loaded:
        raise HTTPException(
            status_code=400,
            detail="No data loaded. Please POST to /data/load first."
        )

    segments_list = []

    for collection in road_collections:
        collection_curvature = tools.get_collection_curvature(collection)
        if collection_curvature < min_curvature:
            continue

        # Extract each segment
        for way in collection['ways']:
            if 'segments' not in way:
                continue

            for seg_idx, segment in enumerate(way['segments']):
                # Check bounding box if provided
                if bbox:
                    try:
                        min_lon, min_lat, max_lon, max_lat = map(float, bbox.split(','))
                        seg_lat = segment['start'][0]
                        seg_lon = segment['start'][1]
                        if not (min_lon <= seg_lon <= max_lon and min_lat <= seg_lat <= max_lat):
                            continue
                    except (ValueError, IndexError):
                        pass  # Skip invalid bbox

                # Create feature for this segment
                feature = {
                    "type": "Feature",
                    "id": f"{way['id']}-{seg_idx}",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [segment['start'][1], segment['start'][0]],  # [lon, lat]
                            [segment['end'][1], segment['end'][0]]
                        ]
                    },
                    "properties": {
                        "way_id": way['id'],
                        "segment_index": seg_idx,
                        "start": segment['start'],
                        "end": segment['end'],
                        "length": segment.get('length', 0),
                        "radius": segment.get('radius', 0),
                        "curvature": segment.get('curvature', 0),
                        "curvature_level": segment.get('curvature_level', 0),
                        "name": way['tags'].get('name', ''),
                        "highway": way['tags'].get('highway', ''),
                        "surface": way['tags'].get('surface', 'unknown')
                    }
                }
                segments_list.append(feature)

                if len(segments_list) >= limit:
                    break
            if len(segments_list) >= limit:
                break
        if len(segments_list) >= limit:
            break

    return JSONResponse(content={
        "type": "FeatureCollection",
        "features": segments_list
    })


@app.post("/routes/save")
async def save_route(request: SaveRouteRequest, session_id: str = Query(..., description="Session ID")):
    """
    Save a stitched route to the database.

    Args:
        request: Route data including name, description, and segments
        session_id: User session ID

    Returns:
        Route ID, URL slug, and share URL
    """
    if not DATABASE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")

    # Validate session
    with get_db() as db:
        session = db.query(RouteSession).filter_by(
            session_id=uuid.UUID(session_id)
        ).first()

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Calculate statistics
        total_curvature = sum(seg.curvature for seg in request.segments)
        total_length = sum(seg.length for seg in request.segments)
        segment_count = len(request.segments)

        # Build geometry
        coords = []
        for idx, seg in enumerate(request.segments):
            if idx == 0:
                coords.append((seg.start[1], seg.start[0]))  # lon, lat
            coords.append((seg.end[1], seg.end[0]))

        linestring = LineString(coords)

        # Generate URL slug
        slug_base = request.route_name.lower().replace(' ', '-')[:30]
        slug_base = ''.join(c for c in slug_base if c.isalnum() or c == '-')
        slug_hash = hashlib.md5(f"{session_id}{request.route_name}{datetime.utcnow()}".encode()).hexdigest()[:8]
        url_slug = f"{slug_base}-{slug_hash}"

        # Create route
        route = SavedRoute(
            session_id=session.session_id,
            route_name=request.route_name,
            description=request.description,
            total_curvature=total_curvature,
            total_length=total_length,
            segment_count=segment_count,
            geom=from_shape(linestring, srid=4326),
            route_data={'segments': [seg.dict() for seg in request.segments]},
            url_slug=url_slug,
            is_public=request.is_public
        )

        db.add(route)
        db.flush()  # Get route_id

        # Add segments
        for idx, seg in enumerate(request.segments):
            route_segment = RouteSegment(
                route_id=route.route_id,
                position=idx + 1,
                start_lat=seg.start[0],
                start_lon=seg.start[1],
                end_lat=seg.end[0],
                end_lon=seg.end[1],
                length=seg.length,
                radius=seg.radius,
                curvature=seg.curvature,
                curvature_level=seg.curvature_level,
                source_way_id=seg.way_id,
                way_name=seg.name,
                highway_type=seg.highway,
                surface_type=seg.surface
            )
            db.add(route_segment)

        db.commit()
        db.refresh(route)

        return {
            "status": "success",
            "route_id": route.route_id,
            "url_slug": url_slug,
            "share_url": f"/routes/{url_slug}"
        }


@app.get("/routes/list")
async def list_routes(session_id: str = Query(..., description="Session ID")):
    """
    List all routes for a session.

    Args:
        session_id: User session ID

    Returns:
        List of routes with summary information
    """
    if not DATABASE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")

    with get_db() as db:
        routes = db.query(SavedRoute).filter_by(
            session_id=uuid.UUID(session_id)
        ).order_by(SavedRoute.created_at.desc()).all()

        return {
            "routes": [
                {
                    "route_id": r.route_id,
                    "route_name": r.route_name,
                    "total_curvature": r.total_curvature,
                    "total_length_km": r.total_length / 1000,
                    "total_length_mi": r.total_length / 1609.34,
                    "segment_count": r.segment_count,
                    "url_slug": r.url_slug,
                    "created_at": r.created_at.isoformat()
                }
                for r in routes
            ]
        }


@app.get("/routes/{route_identifier}")
async def get_route(route_identifier: str):
    """
    Get route details by ID or URL slug.

    Args:
        route_identifier: Route ID (integer) or URL slug (string)

    Returns:
        Route details including GeoJSON and segment data
    """
    if not DATABASE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")

    with get_db() as db:
        # Try as URL slug first
        route = db.query(SavedRoute).filter_by(url_slug=route_identifier).first()

        # Try as route_id
        if not route:
            try:
                route_id = int(route_identifier)
                route = db.query(SavedRoute).filter_by(route_id=route_id).first()
            except ValueError:
                pass

        if not route:
            raise HTTPException(status_code=404, detail="Route not found")

        # Build GeoJSON
        coords = []
        for seg in sorted(route.segments, key=lambda s: s.position):
            if len(coords) == 0:
                coords.append([seg.start_lon, seg.start_lat])
            coords.append([seg.end_lon, seg.end_lat])

        return {
            "route_id": route.route_id,
            "route_name": route.route_name,
            "description": route.description,
            "total_curvature": route.total_curvature,
            "total_length_km": route.total_length / 1000,
            "total_length_mi": route.total_length / 1609.34,
            "segment_count": route.segment_count,
            "url_slug": route.url_slug,
            "created_at": route.created_at.isoformat(),
            "is_public": route.is_public,
            "geojson": {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords
                },
                "properties": {
                    "name": route.route_name,
                    "curvature": route.total_curvature,
                    "length_mi": route.total_length / 1609.34
                }
            },
            "segments": route.route_data['segments']
        }


@app.delete("/routes/{route_id}")
async def delete_route(route_id: int, session_id: str = Query(..., description="Session ID")):
    """
    Delete a saved route.

    Args:
        route_id: Route ID to delete
        session_id: User session ID (for authorization)

    Returns:
        Success message
    """
    if not DATABASE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")

    with get_db() as db:
        route = db.query(SavedRoute).filter_by(
            route_id=route_id,
            session_id=uuid.UUID(session_id)
        ).first()

        if not route:
            raise HTTPException(status_code=404, detail="Route not found or unauthorized")

        db.delete(route)
        db.commit()

        return {"status": "success", "message": "Route deleted"}


@app.put("/routes/{route_id}")
async def update_route(
    route_id: int,
    session_id: str = Query(..., description="Session ID"),
    route_name: Optional[str] = None,
    description: Optional[str] = None,
    is_public: Optional[bool] = None
):
    """
    Update route metadata.

    Args:
        route_id: Route ID to update
        session_id: User session ID (for authorization)
        route_name: New name (optional)
        description: New description (optional)
        is_public: New public status (optional)

    Returns:
        Success message
    """
    if not DATABASE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")

    with get_db() as db:
        route = db.query(SavedRoute).filter_by(
            route_id=route_id,
            session_id=uuid.UUID(session_id)
        ).first()

        if not route:
            raise HTTPException(status_code=404, detail="Route not found")

        if route_name is not None:
            route.route_name = route_name
        if description is not None:
            route.description = description
        if is_public is not None:
            route.is_public = is_public

        db.commit()

        return {"status": "success", "message": "Route updated"}


@app.get("/routes/{route_identifier}/export/kml")
async def export_route_kml(route_identifier: str):
    """
    Export route as KML file for Google Earth.

    Args:
        route_identifier: Route ID or URL slug

    Returns:
        KML file download with enhanced styling and metadata
    """
    if not DATABASE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")

    with get_db() as db:
        kml = generate_kml_for_route(db, route_identifier)

        if not kml:
            raise HTTPException(status_code=404, detail="Route not found")

        # Get route for filename
        from api.export_service import ExportService
        service = ExportService(db)
        route = service.get_route(route_identifier)

        return Response(
            content=kml,
            media_type="application/vnd.google-earth.kml+xml",
            headers={"Content-Disposition": f"attachment; filename={route.url_slug}.kml"}
        )


@app.get("/routes/{route_identifier}/export/gpx")
async def export_route_gpx(route_identifier: str):
    """
    Export route as GPX file for GPS devices.

    Enhanced version with:
    - Dense track points (~30 per mile) for accurate navigation
    - Elevation data from Open-Elevation API
    - Proper GPX 1.1 metadata
    - Optimized coordinate precision (6 decimal places)

    Args:
        route_identifier: Route ID or URL slug

    Returns:
        GPX 1.1 file download
    """
    if not DATABASE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")

    with get_db() as db:
        gpx_xml = await generate_gpx_for_route(db, route_identifier)

        if not gpx_xml:
            raise HTTPException(status_code=404, detail="Route not found")

        # Get route for filename
        from api.export_service import ExportService
        service = ExportService(db)
        route = service.get_route(route_identifier)

        return Response(
            content=gpx_xml,
            media_type="application/gpx+xml",
            headers={"Content-Disposition": f"attachment; filename={route.url_slug}.gpx"}
        )


# Mount the web interface static files
# This allows serving HTML/CSS/JS files from the /web directory
web_path = Path(__file__).parent.parent / "web" / "static"
if web_path.exists():
    app.mount("/static", StaticFiles(directory=str(web_path)), name="static")


# Run the server
# ==============
if __name__ == "__main__":
    import uvicorn

    # Start the server on http://localhost:8000
    # reload=True means the server restarts when code changes (great for development)
    uvicorn.run(
        "server:app",
        host="0.0.0.0",  # Listen on all network interfaces
        port=8000,
        reload=True
    )
