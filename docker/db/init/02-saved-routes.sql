-- =============================================================================
-- Saved Routes Schema for Curvature Application
-- Stores user-created routes built by stitching road segments together
-- =============================================================================

-- User/Session management (simple version, no authentication yet)
CREATE TABLE IF NOT EXISTS route_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT NOW(),
    last_accessed TIMESTAMP DEFAULT NOW(),
    session_name VARCHAR(255)
);

-- Saved routes
CREATE TABLE IF NOT EXISTS saved_routes (
    route_id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES route_sessions(session_id) ON DELETE CASCADE,
    route_name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Aggregated statistics
    total_curvature FLOAT,
    total_length FLOAT,  -- meters
    segment_count INTEGER,

    -- Full route geometry (for map display and spatial queries)
    geom GEOMETRY(LineString, 4326),

    -- Full route data as JSONB (preserves all segment details)
    route_data JSONB,

    -- Shareable URL slug
    url_slug VARCHAR(50) UNIQUE,

    -- Privacy settings
    is_public BOOLEAN DEFAULT FALSE
);

-- Route segments (normalized storage for queries)
CREATE TABLE IF NOT EXISTS route_segments (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES saved_routes(route_id) ON DELETE CASCADE,
    position INTEGER NOT NULL,  -- Order in route (1, 2, 3...)

    -- Segment geometry
    start_lat DOUBLE PRECISION,
    start_lon DOUBLE PRECISION,
    end_lat DOUBLE PRECISION,
    end_lon DOUBLE PRECISION,

    -- Segment metrics
    length FLOAT,
    radius FLOAT,
    curvature FLOAT,
    curvature_level INTEGER,

    -- Source OSM data
    source_way_id BIGINT,  -- OSM way ID
    way_name VARCHAR(500),
    highway_type VARCHAR(100),
    surface_type VARCHAR(100),

    -- Constraints
    UNIQUE(route_id, position)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_routes_session ON saved_routes(session_id);
CREATE INDEX IF NOT EXISTS idx_saved_routes_slug ON saved_routes(url_slug);
CREATE INDEX IF NOT EXISTS idx_saved_routes_geom ON saved_routes USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_saved_routes_public ON saved_routes(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_route_segments_route ON route_segments(route_id);
CREATE INDEX IF NOT EXISTS idx_route_segments_position ON route_segments(route_id, position);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_saved_routes_modtime ON saved_routes;
CREATE TRIGGER update_saved_routes_modtime
    BEFORE UPDATE ON saved_routes
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Comments for documentation
COMMENT ON TABLE route_sessions IS 'User sessions for route building (simple session management)';
COMMENT ON TABLE saved_routes IS 'User-created routes built by stitching road segments';
COMMENT ON TABLE route_segments IS 'Individual segments within a saved route (normalized for querying)';
COMMENT ON COLUMN saved_routes.route_data IS 'Complete route data in JSONB format, preserves all segment details including radius and curvature_level';
COMMENT ON COLUMN saved_routes.geom IS 'PostGIS LineString geometry for spatial queries and map display';
COMMENT ON COLUMN saved_routes.url_slug IS 'Unique slug for shareable URLs (e.g., /routes/my-favorite-route-abc123)';
