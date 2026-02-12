-- =============================================================================
-- Waypoint Routing Schema
-- Adds waypoint storage for OSRM-based route building.
-- =============================================================================

-- Route waypoints (ordered waypoints with optional segment references)
CREATE TABLE IF NOT EXISTS route_waypoints (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES saved_routes(route_id) ON DELETE CASCADE,
    waypoint_order INTEGER NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    segment_id VARCHAR(255),
    is_user_modified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_route_waypoint_order UNIQUE (route_id, waypoint_order)
);

CREATE INDEX IF NOT EXISTS idx_route_waypoints_route_id
    ON route_waypoints(route_id);

-- Add connecting_geometry column to saved_routes for OSRM-calculated routes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'saved_routes'
        AND column_name = 'connecting_geometry'
    ) THEN
        ALTER TABLE saved_routes
        ADD COLUMN connecting_geometry GEOMETRY(LineString, 4326);
    END IF;
END $$;

-- Add route_type column to distinguish route types
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'saved_routes'
        AND column_name = 'route_type'
    ) THEN
        ALTER TABLE saved_routes
        ADD COLUMN route_type VARCHAR(20) DEFAULT 'segment_list';
    END IF;
END $$;

COMMENT ON TABLE route_waypoints IS 'Ordered waypoints for OSRM-based waypoint routes';
COMMENT ON COLUMN saved_routes.connecting_geometry IS 'Full road-snapped route geometry from OSRM (for waypoint routes)';
COMMENT ON COLUMN saved_routes.route_type IS 'Route type: segment_list (original) or waypoint (OSRM-connected)';
