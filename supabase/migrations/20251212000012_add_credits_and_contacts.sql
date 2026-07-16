-- Add image credit column to facilities table
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS image_credit TEXT;

-- Add image credit column to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS image_credit TEXT;

-- Add contact information columns to facilities table
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS facebook TEXT;
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS phone TEXT;
