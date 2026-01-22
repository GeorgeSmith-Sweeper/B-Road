-- =============================================================================
-- B-Road Database Extensions
-- Enable required PostgreSQL extensions for geospatial and UUID support
-- =============================================================================

-- Enable PostGIS for geospatial support
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify extensions are installed
DO $$
BEGIN
    RAISE NOTICE 'PostGIS version: %', PostGIS_Version();
    RAISE NOTICE 'Extensions enabled successfully';
END $$;
