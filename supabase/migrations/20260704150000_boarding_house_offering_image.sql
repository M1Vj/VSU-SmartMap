-- Optional single image per room offering. Objects live in the existing private
-- `boarding-house-photos` bucket under `${listingId}/rooms/${uuid}.{ext}`, so the
-- existing per-listing storage RLS (folder[1] = listing id) already governs them.
DO $$ BEGIN
  IF to_regclass('public.boarding_house_offerings') IS NOT NULL THEN
    ALTER TABLE public.boarding_house_offerings
      ADD COLUMN IF NOT EXISTS image_path TEXT;
  END IF;
END $$;
