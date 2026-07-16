CREATE TYPE facility_category AS ENUM (
  'academic',
  'administrative',
  'research',
  'office',
  'residential',
  'dormitory',
  'lodging',
  'sports',
  'dining',
  'library',
  'medical',
  'parking',
  'landmark',
  'religious',
  'utility',
  'commercial',
  'transportation',
  'atm'
);

CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category facility_category NOT NULL,
  has_rooms BOOLEAN NOT NULL DEFAULT false,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_facilities_category ON facilities(category);
CREATE INDEX idx_facilities_has_rooms ON facilities(has_rooms);
CREATE INDEX idx_facilities_slug ON facilities(slug);
CREATE INDEX idx_facilities_location ON facilities(latitude, longitude);

ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for facilities"
  ON facilities
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage facilities"
  ON facilities
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER facilities_updated_at
  BEFORE UPDATE ON facilities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
