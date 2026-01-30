-- Performance indexes for curvature_segments table
--
-- Run this script after loading curvature data to improve query performance.
-- These indexes optimize the common access patterns used by the curvature API.
--
-- Usage:
--   psql curvature < api/schema/curvature_indexes.sql

-- =============================================================================
-- Spatial Indexes
-- =============================================================================

-- Primary spatial index on geometry (may already exist from curvature.sql)
-- This index enables efficient bounding box queries
CREATE INDEX IF NOT EXISTS idx_curvature_segments_geom_gist
  ON curvature_segments USING GIST (geom);

-- =============================================================================
-- Curvature Filtering Indexes
-- =============================================================================

-- Index for filtering by curvature (most common filter)
-- Supports ORDER BY curvature DESC for returning curviest roads first
CREATE INDEX IF NOT EXISTS idx_curvature_segments_curvature_desc
  ON curvature_segments (curvature DESC);

-- Composite index for source + curvature filtering
-- Optimizes queries that filter by state and then sort by curvature
CREATE INDEX IF NOT EXISTS idx_curvature_segments_source_curvature
  ON curvature_segments (fk_source, curvature DESC);

-- =============================================================================
-- Source/State Indexes
-- =============================================================================

-- Index on foreign key to sources (for joins and filtering)
-- May already exist from original schema
CREATE INDEX IF NOT EXISTS idx_curvature_segments_fk_source
  ON curvature_segments (fk_source);

-- Index on sources table for name lookups
CREATE INDEX IF NOT EXISTS idx_sources_source_name
  ON sources (source);

-- =============================================================================
-- Segment Ways Indexes (for detail queries)
-- =============================================================================

-- Index for looking up ways by segment
CREATE INDEX IF NOT EXISTS idx_segment_ways_fk_segment
  ON segment_ways (fk_segment);

-- Index for tag lookups
CREATE INDEX IF NOT EXISTS idx_segment_ways_fk_highway
  ON segment_ways (fk_highway);

CREATE INDEX IF NOT EXISTS idx_segment_ways_fk_surface
  ON segment_ways (fk_surface);

-- =============================================================================
-- Hash Index for ID lookups
-- =============================================================================

-- B-tree index on id_hash for deduplication lookups
-- (id_hash is used by curvature-output-postgis for upserts)
CREATE INDEX IF NOT EXISTS idx_curvature_segments_id_hash
  ON curvature_segments (id_hash);

-- =============================================================================
-- Partial Indexes for Common Queries
-- =============================================================================

-- Partial index for high-curvature roads (curvature >= 1000)
-- Optimizes zoomed-out map views that only show very curvy roads
CREATE INDEX IF NOT EXISTS idx_curvature_segments_high_curvature
  ON curvature_segments (curvature DESC)
  WHERE curvature >= 1000;

-- Partial index for paved roads only
-- Common filter when looking for motorcycle-friendly roads
CREATE INDEX IF NOT EXISTS idx_curvature_segments_paved
  ON curvature_segments (curvature DESC)
  WHERE paved = true;

-- =============================================================================
-- Partial Spatial Indexes for Vector Tile Queries
-- =============================================================================

-- Partial GIST index for moderate+ curvature roads (curvature >= 300)
-- Optimizes vector tile queries at zoom > 10
CREATE INDEX IF NOT EXISTS idx_curvature_segments_geom_curv300
  ON curvature_segments USING GIST (geom)
  WHERE curvature >= 300;

-- Partial GIST index for high curvature roads (curvature >= 1000)
-- Optimizes vector tile queries at zoom < 8
CREATE INDEX IF NOT EXISTS idx_curvature_segments_geom_curv1000
  ON curvature_segments USING GIST (geom)
  WHERE curvature >= 1000;

-- =============================================================================
-- Analyze Tables
-- =============================================================================

-- Update statistics for query planner
ANALYZE curvature_segments;
ANALYZE sources;
ANALYZE segment_ways;
ANALYZE tags;

-- =============================================================================
-- Verification Query
-- =============================================================================

-- Run this query to verify indexes are being used:
-- EXPLAIN ANALYZE
-- SELECT id, name, curvature, ST_AsGeoJSON(ST_Transform(geom, 4326))
-- FROM curvature_segments
-- WHERE ST_Intersects(geom, ST_Transform(ST_MakeEnvelope(-73.5, 42.7, -71.5, 45.0, 4326), 900913))
-- AND curvature >= 300
-- ORDER BY curvature DESC
-- LIMIT 1000;
