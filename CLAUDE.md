# B-Road Project Memory

## Architecture Overview
- Backend: FastAPI + PostgreSQL/PostGIS (Python 3.9+)
- Current Frontend: Vanilla JS + Google Maps API (being replaced with Mapbox)
- New Mobile: React Native + Mapbox Navigation SDK
- Data Source: Curvature project (OSM-based twisty road analysis)

## Key Conventions
- All coordinates in WGS84 (SRID 4326)
- Route segments stored as LINESTRING geometry in PostGIS
- GPX exports use version 1.1 with dense track points
- API endpoints follow REST conventions: /api/v1/routes/
- Database: Use SQLAlchemy ORM with GeoAlchemy2 for spatial types

## Current Database Schema
- route_sessions: User session management
- saved_routes: Route metadata + PostGIS LINESTRING geometry
- route_segments: Individual segments with curvature scores

## Critical Spatial Queries
- Segment connectivity: ST_Intersects(segment1.geom, segment2.geom)
- Route simplification: ST_SimplifyPreserveTopology(route.geom, tolerance)
- Distance calculation: ST_Length(geography(geom))

## Development Commands
- Backend: cd api && uvicorn server:app --reload
- Database: psql curvature < api/schema/saved_routes.sql
- Curvature processing: ./processing_chains/adams_default.sh data.osm.pbf output

## Known Issues to Fix
1. Google Maps can't import GPX - migrate to Mapbox
2. Performance degradation with >100 segments per route
3. No mobile app for CarPlay/Android Auto integration
4. Route validation sometimes allows disconnected segments
5. GPX exports don't have elevation data

## Sprint 1 Focus
- Refactor backend API into clean service layers
- Replace Google Maps with Mapbox GL JS
- Begin React Native mobile app prototype
- Write comprehensive PostGIS query tests
EOF# B-Road Project Memory

## Architecture Overview
- Backend: FastAPI + PostgreSQL/PostGIS (Python 3.9+)
- Current Frontend: Vanilla JS + Google Maps API (being replaced with Mapbox)
- New Mobile: React Native + Mapbox Navigation SDK
- Data Source: Curvature project (OSM-based twisty road analysis)

## Key Conventions
- All coordinates in WGS84 (SRID 4326)
- Route segments stored as LINESTRING geometry in PostGIS
- GPX exports use version 1.1 with dense track points
- API endpoints follow REST conventions: /api/v1/routes/
- Database: Use SQLAlchemy ORM with GeoAlchemy2 for spatial types

## Current Database Schema
- route_sessions: User session management
- saved_routes: Route metadata + PostGIS LINESTRING geometry
- route_segments: Individual segments with curvature scores

## Critical Spatial Queries
- Segment connectivity: ST_Intersects(segment1.geom, segment2.geom)
- Route simplification: ST_SimplifyPreserveTopology(route.geom, tolerance)
- Distance calculation: ST_Length(geography(geom))

## Development Commands
- Backend: cd api && uvicorn server:app --reload
- Database: psql curvature < api/schema/saved_routes.sql
- Curvature processing: ./processing_chains/adams_default.sh data.osm.pbf output

## Known Issues to Fix
1. Google Maps can't import GPX - migrate to Mapbox
2. Performance degradation with >100 segments per route
3. No mobile app for CarPlay/Android Auto integration
4. Route validation sometimes allows disconnected segments
5. GPX exports don't have elevation data

## Sprint 1 Focus
- Refactor backend API into clean service layers
- Replace Google Maps with Mapbox GL JS
- Begin React Native mobile app prototype
- Write comprehensive PostGIS query tests
