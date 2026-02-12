#!/usr/bin/env python
# -*- coding: UTF-8 -*-
"""
Curvature API Server
====================
A FastAPI-based REST API for querying curvature road data.

This server provides endpoints to:
- Search for curvy roads by various criteria
- Return GeoJSON for map visualization

Author: George Smith-Sweeper (contribution to adamfranco/curvature)
"""

import os
import sys
from pathlib import Path

# Load environment variables from .env file
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# Add parent directory to path to import curvature modules
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Check database availability
try:
    from api.database import DATABASE_AVAILABLE
except ImportError:
    DATABASE_AVAILABLE = False
    print("Warning: Database module not available")

# Import routers
from api.routers import health, curvature, tiles, chat, routes, sessions, routing

# Initialize FastAPI app
app = FastAPI(
    title="Curvature API",
    description="API for finding and exploring curvy roads",
    version="1.0.0",
)

# Enable CORS so web browsers can access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(health.router)
app.include_router(chat.router)
app.include_router(routing.router)

# Mount database-dependent routers only if database is available
if DATABASE_AVAILABLE:
    app.include_router(curvature.router)
    app.include_router(tiles.router)
    app.include_router(routes.router)
    app.include_router(sessions.router)
else:
    print("Warning: Database not available. Curvature data features disabled.")
    print("Install requirements: pip install -r api/requirements.txt")

# Mount the web interface static files
web_path = Path(__file__).parent.parent / "web" / "static"
if web_path.exists():
    app.mount("/static", StaticFiles(directory=str(web_path)), name="static")

# Run the server
if __name__ == "__main__":
    import uvicorn

    # Start the server on http://localhost:8000
    # reload=True means the server restarts when code changes (great for development)
    uvicorn.run(
        "server:app",
        host="0.0.0.0",  # Listen on all network interfaces
        port=8000,
        reload=True,
    )
