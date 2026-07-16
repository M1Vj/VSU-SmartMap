CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_facilities_name_trgm 
  ON facilities USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_rooms_room_code_trgm 
  ON rooms USING gin (room_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_facilities_category_updated 
  ON facilities(category, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_facilities_has_rooms_category 
  ON facilities(has_rooms, category);
