-- =============================================================================
-- Curvature Segments Schema
-- Tables for storing processed curvature data from OSM
-- =============================================================================

-- Sources table (regions/datasets)
CREATE TABLE IF NOT EXISTS sources (
    id SERIAL PRIMARY KEY,
    source VARCHAR(500)
);

-- Tags table (highway types, surface types, etc.)
CREATE TABLE IF NOT EXISTS tags (
    tag_id SERIAL PRIMARY KEY,
    tag_name VARCHAR(500),
    tag_value VARCHAR(500),
    UNIQUE(tag_name, tag_value)
);

-- Curvature segments table (main road segments)
CREATE TABLE IF NOT EXISTS curvature_segments (
    id SERIAL PRIMARY KEY,
    id_hash CHARACTER(40) NOT NULL UNIQUE,
    name VARCHAR(500),
    curvature INTEGER,
    length INTEGER,
    paved BOOLEAN DEFAULT FALSE NOT NULL,
    fk_source INTEGER REFERENCES sources(id) ON UPDATE CASCADE ON DELETE CASCADE,
    geom GEOMETRY(LineString, 4326),
    hash CHARACTER(40)
);

COMMENT ON COLUMN curvature_segments.id_hash IS 'Sha1 hash of the constituent way-ids.';
COMMENT ON COLUMN curvature_segments.id IS 'Synthetic auto-increment id for joining.';

-- Segment ways table (individual OSM ways within a segment)
CREATE TABLE IF NOT EXISTS segment_ways (
    fk_segment INTEGER NOT NULL REFERENCES curvature_segments(id) ON UPDATE CASCADE ON DELETE CASCADE,
    position INTEGER,
    id INTEGER NOT NULL,
    name VARCHAR(500),
    fk_highway INTEGER NOT NULL REFERENCES tags(tag_id) ON DELETE RESTRICT,
    fk_surface INTEGER NOT NULL REFERENCES tags(tag_id) ON DELETE RESTRICT,
    fk_maxspeed INTEGER REFERENCES tags(tag_id) ON DELETE RESTRICT,
    fk_smoothness INTEGER REFERENCES tags(tag_id) ON DELETE RESTRICT,
    curvature INTEGER,
    length INTEGER,
    min_lon DOUBLE PRECISION,
    max_lon DOUBLE PRECISION,
    min_lat DOUBLE PRECISION,
    max_lat DOUBLE PRECISION,
    PRIMARY KEY (fk_segment, id)
);

COMMENT ON COLUMN segment_ways.id IS 'The OSM Id of the way.';
COMMENT ON COLUMN segment_ways.name IS 'The name of the way.';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS curvature_segment_geom ON curvature_segments USING GIST(geom);
CREATE INDEX IF NOT EXISTS curvature_segments_length_idx ON curvature_segments USING BTREE(curvature, length);
CREATE INDEX IF NOT EXISTS fki_foreign_key_source ON curvature_segments USING BTREE(fk_source);
CREATE INDEX IF NOT EXISTS fki_segment_ways_fk_highway_key ON segment_ways USING BTREE(fk_highway);
CREATE INDEX IF NOT EXISTS fki_segment_ways_fk_surface_key ON segment_ways USING BTREE(fk_surface);
CREATE INDEX IF NOT EXISTS length_idx ON curvature_segments USING BTREE(length);
