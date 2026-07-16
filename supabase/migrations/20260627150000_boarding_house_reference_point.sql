-- Walking-time reference point: the place a listing's walking time is measured to.
-- Defaults to the VSU main gate; owners can pin a custom reference on the map.
ALTER TABLE boarding_house_listings
  ADD COLUMN IF NOT EXISTS reference_label TEXT NOT NULL DEFAULT 'VSU main gate'
    CHECK (char_length(reference_label) BETWEEN 1 AND 120),
  ADD COLUMN IF NOT EXISTS reference_latitude DOUBLE PRECISION
    CHECK (reference_latitude IS NULL OR (reference_latitude BETWEEN -90 AND 90)),
  ADD COLUMN IF NOT EXISTS reference_longitude DOUBLE PRECISION
    CHECK (reference_longitude IS NULL OR (reference_longitude BETWEEN -180 AND 180));
