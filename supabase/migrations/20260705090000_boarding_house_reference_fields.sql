-- Fields PH students actually compare when picking a boarding house, modeled
-- after local listing sites: smoking rule, drying area, a constrained safety
-- checklist (BFP-style items + fencing), the common per-appliance monthly fee,
-- and which mobile networks have usable signal at the property.
DO $$ BEGIN
  IF to_regclass('public.boarding_house_listings') IS NOT NULL THEN
    ALTER TABLE public.boarding_house_listings
      ADD COLUMN IF NOT EXISTS smoking_allowed BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS drying_area BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS safety_features TEXT[] NOT NULL DEFAULT '{}'
        CHECK (
          safety_features <@ ARRAY[
            'cctv',
            'fire_extinguisher',
            'smoke_detector',
            'fire_alarm',
            'emergency_exit',
            'emergency_lights',
            'sprinkler',
            'fenced_property'
          ]::TEXT[]
        ),
      ADD COLUMN IF NOT EXISTS appliance_fee INTEGER
        CHECK (appliance_fee IS NULL OR appliance_fee BETWEEN 0 AND 10000),
      ADD COLUMN IF NOT EXISTS mobile_carriers TEXT[] NOT NULL DEFAULT '{}'
        CHECK (mobile_carriers <@ ARRAY['smart', 'globe', 'dito']::TEXT[]);
  END IF;
END $$;
