-- Atomic utility inclusions + move-in terms for boarding house listings.
-- water/electricity/internet replace the coarse "utilities_included" flag as the
-- source of truth; utilities_included is kept as the legacy "all utilities" hint.
-- advance/deposit months capture the PH move-in norm (typically 1 + 1).
DO $$ BEGIN
  IF to_regclass('public.boarding_house_listings') IS NOT NULL THEN
    ALTER TABLE public.boarding_house_listings
      ADD COLUMN IF NOT EXISTS water_included BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS electricity_included BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS internet_included BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS private_bathroom BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS advance_months SMALLINT
        CHECK (advance_months IS NULL OR advance_months BETWEEN 0 AND 12),
      ADD COLUMN IF NOT EXISTS deposit_months SMALLINT
        CHECK (deposit_months IS NULL OR deposit_months BETWEEN 0 AND 12);

    -- Backfill: legacy "all utilities included" implies water + electricity.
    UPDATE public.boarding_house_listings
      SET water_included = true, electricity_included = true
      WHERE utilities_included = true;
  END IF;
END $$;

-- Per-room detail so a single boarding house can list rooms that differ in size,
-- capacity, price, aircon, and bathroom arrangement.
DO $$ BEGIN
  IF to_regclass('public.boarding_house_offerings') IS NOT NULL THEN
    ALTER TABLE public.boarding_house_offerings
      ADD COLUMN IF NOT EXISTS capacity SMALLINT
        CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 20),
      ADD COLUMN IF NOT EXISTS size_sqm NUMERIC(5,1)
        CHECK (size_sqm IS NULL OR size_sqm > 0),
      ADD COLUMN IF NOT EXISTS has_aircon BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS private_bathroom BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
