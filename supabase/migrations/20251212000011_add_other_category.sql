-- Add 'other' to facility_category enum
ALTER TYPE facility_category ADD VALUE IF NOT EXISTS 'other';
