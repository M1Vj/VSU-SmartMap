-- Drop the legacy coarse utility flags. water_included + electricity_included are
-- the utility-inclusion source of truth (backfilled in 20260704120000) and wifi is
-- the single connectivity flag, so utilities_included and internet_included retire.
DO $$ BEGIN
  IF to_regclass('public.boarding_house_listings') IS NOT NULL THEN
    ALTER TABLE public.boarding_house_listings
      DROP COLUMN IF EXISTS utilities_included,
      DROP COLUMN IF EXISTS internet_included;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.boarding_house_offerings') IS NOT NULL THEN
    ALTER TABLE public.boarding_house_offerings
      DROP COLUMN IF EXISTS utilities_included;
  END IF;
END $$;
