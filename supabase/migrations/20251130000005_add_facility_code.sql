-- Add code column to facilities table
-- Code is a short unique identifier (e.g., CAS, ICT, CSAT)

ALTER TABLE facilities
ADD COLUMN code TEXT UNIQUE;

-- Create index for fast lookups by code
CREATE INDEX idx_facilities_code ON facilities(code);

COMMENT ON COLUMN facilities.code IS 'Short unique identifier for the facility (e.g., CAS, ICT, CSAT)';
