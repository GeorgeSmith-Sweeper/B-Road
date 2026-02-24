-- Road Rating Migration
-- Adds road_rating column to saved_routes for persisting the curvature-derived rating.
-- This migration is idempotent (safe to run multiple times).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'saved_routes'
        AND column_name = 'road_rating'
    ) THEN
        ALTER TABLE saved_routes
        ADD COLUMN road_rating VARCHAR(20);
    END IF;
END $$;

COMMENT ON COLUMN saved_routes.road_rating IS 'Curvature-derived road rating label (RELAXED, SPIRITED, ENGAGING, TECHNICAL, EXPERT, LEGENDARY)';
