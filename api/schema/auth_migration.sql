-- Add user_id column to saved_routes for Clerk authentication
-- Routes with only session_id = anonymous, routes with user_id = claimed/authenticated

ALTER TABLE saved_routes ADD COLUMN user_id VARCHAR(255);
CREATE INDEX idx_saved_routes_user_id ON saved_routes(user_id);
