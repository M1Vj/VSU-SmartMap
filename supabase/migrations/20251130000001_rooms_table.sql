CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  room_code TEXT NOT NULL,
  name TEXT,
  description TEXT,
  floor INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT rooms_facility_room_code_unique UNIQUE (facility_id, room_code)
);

CREATE INDEX IF NOT EXISTS idx_rooms_facility_id ON rooms(facility_id);
CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON rooms(room_code);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for rooms"
  ON rooms
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage rooms"
  ON rooms
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
