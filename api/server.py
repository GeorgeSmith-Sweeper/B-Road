#!/usr/bin/env python
# -*- coding: UTF-8 -*-
"""
B-Road API Server
=================
A simplified FastAPI-based REST API for browsing curvature road data.

This server provides endpoints to:
- Load and filter msgpack data from any region
- Return GeoJSON for Mapbox visualization
- Serve configuration for the frontend

No database required - all data loaded from msgpack files.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import health, data

app = FastAPI(
    title="B-Road API",
    description="API for browsing curvy roads from curvature data",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(data.router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
