-- Waypoint Routing Schema Migration
-- Adds waypoint storage for OSRM-based route building.
-- This migration is idempotent (safe to run multiple times).

-- Route waypoints (ordered waypoints with optional segment references)
CREATE TABLE IF NOT EXISTS route_waypoints (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES saved_routes(route_id) ON DELETE CASCADE,
    waypoint_order INTEGER NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    segment_id VARCHAR(255),         -- Reference to curvature segment if from click
    is_user_modified BOOLEAN DEFAULT FALSE,  -- True if user dragged this waypoint
    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_route_waypoint_order UNIQUE (route_id, waypoint_order)
);

CREATE INDEX IF NOT EXISTS idx_route_waypoints_route_id
    ON route_waypoints(route_id);

-- Add connecting_geometry column to saved_routes for OSRM-calculated routes.
-- This stores the full road-snapped route geometry from OSRM, separate from
-- the existing geom column which stores segment-list route geometry.
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

-- Add route_type column to distinguish segment-list routes from waypoint routes
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

-- Comments
COMMENT ON TABLE route_waypoints IS 'Ordered waypoints for OSRM-based waypoint routes';
COMMENT ON COLUMN route_waypoints.segment_id IS 'Reference to curvature_segments if waypoint was created from segment click';
COMMENT ON COLUMN route_waypoints.is_user_modified IS 'True if user manually dragged this waypoint to a new position';
COMMENT ON COLUMN saved_routes.connecting_geometry IS 'Full road-snapped route geometry from OSRM (for waypoint routes)';
COMMENT ON COLUMN saved_routes.route_type IS 'Route type: segment_list (original) or waypoint (OSRM-connected)';
