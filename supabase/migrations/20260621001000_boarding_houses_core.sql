CREATE TYPE app_user_role AS ENUM (
  'admin',
  'boarding_house_owner'
);

CREATE TYPE owner_application_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'withdrawn'
);

CREATE TYPE boarding_house_status AS ENUM (
  'draft',
  'pending_review',
  'published',
  'rejected',
  'unpublished',
  'suspended'
);

CREATE TYPE boarding_house_verification_status AS ENUM (
  'unverified',
  'pending',
  'verified',
  'rejected',
  'expired'
);

CREATE TYPE boarding_house_room_type AS ENUM (
  'bedspace',
  'shared_room',
  'private_room',
  'studio',
  'whole_unit'
);

CREATE TYPE boarding_house_occupancy_policy AS ENUM (
  'any_gender',
  'female_only',
  'male_only',
  'family_only'
);

CREATE TYPE boarding_house_report_status AS ENUM (
  'open',
  'reviewing',
  'resolved',
  'dismissed'
);

CREATE TYPE boarding_house_review_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'hidden'
);

CREATE TABLE IF NOT EXISTS app_user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_user_role NOT NULL,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_app_role(required_role app_user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_user_roles
    WHERE user_id = auth.uid()
      AND role = required_role
  );
$$;

-- Harden the shared timestamp trigger with a fixed search_path.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS owner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 120),
  phone TEXT,
  facebook_url TEXT,
  email TEXT,
  verification_status boarding_house_verification_status NOT NULL DEFAULT 'unverified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS owner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 120),
  phone TEXT NOT NULL CHECK (char_length(phone) BETWEEN 5 AND 40),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 5 AND 254),
  authority_notes TEXT NOT NULL CHECK (char_length(authority_notes) BETWEEN 10 AND 2000),
  status owner_application_status NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_note TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS owner_verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES owner_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL DEFAULT 'boarding-house-verification',
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  delete_after TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (storage_bucket, storage_path)
);

CREATE TABLE IF NOT EXISTS boarding_house_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES owner_profiles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 140),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  address_line TEXT NOT NULL CHECK (char_length(address_line) BETWEEN 4 AND 240),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  status boarding_house_status NOT NULL DEFAULT 'draft',
  verification_status boarding_house_verification_status NOT NULL DEFAULT 'unverified',
  contact_phone TEXT,
  contact_facebook TEXT,
  contact_email TEXT,
  thumbnail_url TEXT,
  price_min INTEGER CHECK (price_min IS NULL OR price_min >= 0),
  price_max INTEGER CHECK (price_max IS NULL OR price_max >= 0),
  price_changed_at TIMESTAMPTZ,
  available_slots INTEGER CHECK (available_slots IS NULL OR available_slots >= 0),
  room_types boarding_house_room_type[] NOT NULL DEFAULT '{}',
  occupancy_policies boarding_house_occupancy_policy[] NOT NULL DEFAULT '{}',
  wifi BOOLEAN NOT NULL DEFAULT false,
  cooking_allowed BOOLEAN NOT NULL DEFAULT false,
  furnished BOOLEAN NOT NULL DEFAULT false,
  utilities_included BOOLEAN NOT NULL DEFAULT false,
  air_conditioning BOOLEAN NOT NULL DEFAULT false,
  laundry_area BOOLEAN NOT NULL DEFAULT false,
  parking BOOLEAN NOT NULL DEFAULT false,
  study_area BOOLEAN NOT NULL DEFAULT false,
  has_curfew BOOLEAN NOT NULL DEFAULT false,
  curfew_time TIME,
  allows_visitors BOOLEAN NOT NULL DEFAULT false,
  allows_pets BOOLEAN NOT NULL DEFAULT false,
  walking_minutes_to_campus_gate INTEGER CHECK (
    walking_minutes_to_campus_gate IS NULL OR walking_minutes_to_campus_gate >= 0
  ),
  published_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner_display_name TEXT NOT NULL DEFAULT '',
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (avg_rating >= 0 AND avg_rating <= 5),
  rating_count INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  CHECK (price_min IS NULL OR price_max IS NULL OR price_min <= price_max)
);

CREATE TABLE IF NOT EXISTS boarding_house_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES boarding_house_listings(id) ON DELETE CASCADE,
  room_type boarding_house_room_type NOT NULL,
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 2 AND 120),
  monthly_price INTEGER NOT NULL CHECK (monthly_price >= 0),
  available_slots INTEGER NOT NULL DEFAULT 0 CHECK (available_slots >= 0),
  occupancy_policy boarding_house_occupancy_policy NOT NULL DEFAULT 'any_gender',
  utilities_included BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boarding_house_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES boarding_house_listings(id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL DEFAULT 'boarding-house-photos',
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (storage_bucket, storage_path)
);

CREATE TABLE IF NOT EXISTS boarding_house_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES boarding_house_listings(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES owner_profiles(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status boarding_house_status NOT NULL DEFAULT 'pending_review',
  safe_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_note TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boarding_house_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES boarding_house_listings(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 80),
  details TEXT NOT NULL CHECK (char_length(details) BETWEEN 10 AND 2000),
  reporter_contact TEXT CHECK (reporter_contact IS NULL OR char_length(reporter_contact) <= 254),
  status boarding_house_report_status NOT NULL DEFAULT 'open',
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boarding_house_moderation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES boarding_house_listings(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (char_length(event_type) BETWEEN 2 AND 80),
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boarding_house_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES boarding_house_listings(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_display_name TEXT NOT NULL DEFAULT '' CHECK (char_length(author_display_name) <= 120),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  status boarding_house_review_status NOT NULL DEFAULT 'approved',
  is_verified_stay BOOLEAN NOT NULL DEFAULT false,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_app_user_roles_role ON app_user_roles(role);
CREATE INDEX IF NOT EXISTS idx_owner_applications_status ON owner_applications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_boarding_house_listings_public
  ON boarding_house_listings(status, verification_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_boarding_house_listings_location
  ON boarding_house_listings(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_boarding_house_listings_owner
  ON boarding_house_listings(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_boarding_house_offerings_listing
  ON boarding_house_offerings(listing_id);
CREATE INDEX IF NOT EXISTS idx_boarding_house_photos_listing
  ON boarding_house_photos(listing_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_boarding_house_reports_status
  ON boarding_house_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_boarding_house_listings_public_live
  ON boarding_house_listings(updated_at DESC)
  WHERE status = 'published' AND verification_status = 'verified';
CREATE INDEX IF NOT EXISTS idx_boarding_house_listings_room_types
  ON boarding_house_listings USING GIN (room_types);
CREATE INDEX IF NOT EXISTS idx_boarding_house_listings_occupancy
  ON boarding_house_listings USING GIN (occupancy_policies);
CREATE INDEX IF NOT EXISTS idx_boarding_house_reviews_listing
  ON boarding_house_reviews(listing_id, status);

CREATE OR REPLACE FUNCTION public.set_boarding_house_owner_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT display_name INTO NEW.owner_display_name
  FROM public.owner_profiles
  WHERE id = NEW.owner_id;
  IF NEW.owner_display_name IS NULL OR NEW.owner_display_name = '' THEN
    NEW.owner_display_name := 'Verified owner';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.propagate_owner_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.display_name IS DISTINCT FROM OLD.display_name THEN
    PERFORM set_config('app.bypass_listing_guard', 'on', true);
    UPDATE public.boarding_house_listings
    SET owner_display_name = NEW.display_name
    WHERE owner_id = NEW.id;
    PERFORM set_config('app.bypass_listing_guard', 'off', true);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_owner_listing_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR public.has_app_role('admin')
     OR current_setting('app.bypass_listing_guard', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    RAISE EXCEPTION 'Owners cannot change verification status';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('draft', 'pending_review', 'unpublished') THEN
    RAISE EXCEPTION 'Owners cannot set listing status to %', NEW.status;
  END IF;

  NEW.published_at := OLD.published_at;
  NEW.suspended_at := OLD.suspended_at;
  NEW.rejected_at := OLD.rejected_at;
  NEW.avg_rating := OLD.avg_rating;
  NEW.rating_count := OLD.rating_count;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_boarding_house_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_listing UUID := COALESCE(NEW.listing_id, OLD.listing_id);
  new_avg NUMERIC(3,2);
  new_count INTEGER;
BEGIN
  SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0), COUNT(*)
  INTO new_avg, new_count
  FROM public.boarding_house_reviews
  WHERE listing_id = target_listing AND status = 'approved';

  PERFORM set_config('app.bypass_listing_guard', 'on', true);
  UPDATE public.boarding_house_listings
  SET avg_rating = new_avg, rating_count = new_count
  WHERE id = target_listing;
  PERFORM set_config('app.bypass_listing_guard', 'off', true);

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_expired_verification_documents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc RECORD;
BEGIN
  FOR doc IN
    SELECT id, storage_bucket, storage_path
    FROM public.owner_verification_documents
    WHERE delete_after IS NOT NULL AND delete_after < now()
  LOOP
    DELETE FROM storage.objects
    WHERE bucket_id = doc.storage_bucket AND name = doc.storage_path;
    DELETE FROM public.owner_verification_documents WHERE id = doc.id;
  END LOOP;
END;
$$;

CREATE TRIGGER owner_profiles_updated_at
  BEFORE UPDATE ON owner_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER owner_applications_updated_at
  BEFORE UPDATE ON owner_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER boarding_house_listings_updated_at
  BEFORE UPDATE ON boarding_house_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER boarding_house_offerings_updated_at
  BEFORE UPDATE ON boarding_house_offerings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER boarding_house_reports_updated_at
  BEFORE UPDATE ON boarding_house_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER boarding_house_reviews_updated_at
  BEFORE UPDATE ON boarding_house_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER boarding_house_listings_set_owner_name
  BEFORE INSERT OR UPDATE OF owner_id ON boarding_house_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_boarding_house_owner_display_name();

CREATE TRIGGER owner_profiles_propagate_display_name
  AFTER UPDATE OF display_name ON owner_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_owner_display_name();

CREATE TRIGGER boarding_house_listings_enforce_owner_transition
  BEFORE UPDATE ON boarding_house_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_owner_listing_transition();

CREATE TRIGGER boarding_house_reviews_aggregate_rating
  AFTER INSERT OR UPDATE OR DELETE ON boarding_house_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.recompute_boarding_house_rating();

ALTER TABLE app_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE boarding_house_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE boarding_house_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE boarding_house_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE boarding_house_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE boarding_house_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE boarding_house_moderation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE boarding_house_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own app roles"
  ON app_user_roles
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can manage app roles"
  ON app_user_roles
  FOR ALL
  TO authenticated
  USING (public.has_app_role('admin'))
  WITH CHECK (public.has_app_role('admin'));

CREATE POLICY "Owners can read their own profile"
  ON owner_profiles
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id OR public.has_app_role('admin'));

CREATE POLICY "Owners can update safe profile fields"
  ON owner_profiles
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Admins can manage owner profiles"
  ON owner_profiles
  FOR ALL
  TO authenticated
  USING (public.has_app_role('admin'))
  WITH CHECK (public.has_app_role('admin'));

CREATE POLICY "Users can create owner applications"
  ON owner_applications
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can read their own owner applications"
  ON owner_applications
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id OR public.has_app_role('admin'));

CREATE POLICY "Admins can update owner applications"
  ON owner_applications
  FOR UPDATE
  TO authenticated
  USING (public.has_app_role('admin'))
  WITH CHECK (public.has_app_role('admin'));

CREATE POLICY "Users can create their own verification document rows"
  ON owner_verification_documents
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can read their own verification document rows"
  ON owner_verification_documents
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id OR public.has_app_role('admin'));

CREATE POLICY "Admins can manage verification document rows"
  ON owner_verification_documents
  FOR ALL
  TO authenticated
  USING (public.has_app_role('admin'))
  WITH CHECK (public.has_app_role('admin'));

CREATE POLICY "Public can read published verified boarding houses"
  ON boarding_house_listings
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published' AND verification_status = 'verified');

CREATE POLICY "Owners can read their own boarding houses"
  ON boarding_house_listings
  FOR SELECT
  TO authenticated
  USING (
    owner_id IN (
      SELECT id FROM owner_profiles WHERE user_id = (select auth.uid())
    )
    OR public.has_app_role('admin')
  );

CREATE POLICY "Owners can create boarding house drafts"
  ON boarding_house_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status = 'draft'
    AND verification_status = 'unverified'
    AND owner_id IN (
      SELECT id FROM owner_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Owners can update their own non-suspended boarding houses"
  ON boarding_house_listings
  FOR UPDATE
  TO authenticated
  USING (
    status <> 'suspended'
    AND owner_id IN (
      SELECT id FROM owner_profiles WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    owner_id IN (
      SELECT id FROM owner_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Admins can manage boarding houses"
  ON boarding_house_listings
  FOR ALL
  TO authenticated
  USING (public.has_app_role('admin'))
  WITH CHECK (public.has_app_role('admin'));

CREATE POLICY "Public can read published verified boarding house offerings"
  ON boarding_house_offerings
  FOR SELECT
  TO anon, authenticated
  USING (
    listing_id IN (
      SELECT id
      FROM boarding_house_listings
      WHERE status = 'published'
        AND verification_status = 'verified'
    )
  );

CREATE POLICY "Owners can manage their own boarding house offerings"
  ON boarding_house_offerings
  FOR ALL
  TO authenticated
  USING (
    listing_id IN (
      SELECT listing.id
      FROM boarding_house_listings listing
      JOIN owner_profiles owner_profile ON owner_profile.id = listing.owner_id
      WHERE owner_profile.user_id = (select auth.uid())
    )
    OR public.has_app_role('admin')
  )
  WITH CHECK (
    listing_id IN (
      SELECT listing.id
      FROM boarding_house_listings listing
      JOIN owner_profiles owner_profile ON owner_profile.id = listing.owner_id
      WHERE owner_profile.user_id = (select auth.uid())
    )
    OR public.has_app_role('admin')
  );

CREATE POLICY "Public can read published verified boarding house photos"
  ON boarding_house_photos
  FOR SELECT
  TO anon, authenticated
  USING (
    listing_id IN (
      SELECT id
      FROM boarding_house_listings
      WHERE status = 'published'
        AND verification_status = 'verified'
    )
  );

CREATE POLICY "Owners can manage their own boarding house photos"
  ON boarding_house_photos
  FOR ALL
  TO authenticated
  USING (
    listing_id IN (
      SELECT listing.id
      FROM boarding_house_listings listing
      JOIN owner_profiles owner_profile ON owner_profile.id = listing.owner_id
      WHERE owner_profile.user_id = (select auth.uid())
    )
    OR public.has_app_role('admin')
  )
  WITH CHECK (
    listing_id IN (
      SELECT listing.id
      FROM boarding_house_listings listing
      JOIN owner_profiles owner_profile ON owner_profile.id = listing.owner_id
      WHERE owner_profile.user_id = (select auth.uid())
    )
    OR public.has_app_role('admin')
  );

CREATE POLICY "Owners can read their own listing revisions"
  ON boarding_house_revisions
  FOR SELECT
  TO authenticated
  USING (
    submitted_by = (select auth.uid())
    OR public.has_app_role('admin')
  );

CREATE POLICY "Owners can create their own listing revisions"
  ON boarding_house_revisions
  FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = (select auth.uid()));

CREATE POLICY "Admins can manage listing revisions"
  ON boarding_house_revisions
  FOR ALL
  TO authenticated
  USING (public.has_app_role('admin'))
  WITH CHECK (public.has_app_role('admin'));

CREATE POLICY "Anyone can report a published boarding house"
  ON boarding_house_reports
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM boarding_house_listings WHERE status = 'published'
    )
  );

CREATE POLICY "Admins can manage boarding house reports"
  ON boarding_house_reports
  FOR ALL
  TO authenticated
  USING (public.has_app_role('admin'))
  WITH CHECK (public.has_app_role('admin'));

CREATE POLICY "Admins can read moderation events"
  ON boarding_house_moderation_events
  FOR SELECT
  TO authenticated
  USING (public.has_app_role('admin'));

CREATE POLICY "Admins can create moderation events"
  ON boarding_house_moderation_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_app_role('admin'));

CREATE POLICY "Public can read approved boarding house reviews"
  ON boarding_house_reviews
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'approved'
    AND listing_id IN (
      SELECT id FROM boarding_house_listings
      WHERE status = 'published' AND verification_status = 'verified'
    )
  );

CREATE POLICY "Authors can read their own boarding house reviews"
  ON boarding_house_reviews
  FOR SELECT
  TO authenticated
  USING (author_id = (select auth.uid()) OR public.has_app_role('admin'));

CREATE POLICY "Authenticated users can create their own boarding house reviews"
  ON boarding_house_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (select auth.uid())
    AND listing_id IN (
      SELECT id FROM boarding_house_listings
      WHERE status = 'published' AND verification_status = 'verified'
    )
    AND listing_id NOT IN (
      SELECT listing.id
      FROM boarding_house_listings listing
      JOIN owner_profiles owner_profile ON owner_profile.id = listing.owner_id
      WHERE owner_profile.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Authors can update their own boarding house reviews"
  ON boarding_house_reviews
  FOR UPDATE
  TO authenticated
  USING (
    author_id = (select auth.uid())
    AND status NOT IN ('hidden', 'rejected')
  )
  WITH CHECK (author_id = (select auth.uid()));

CREATE POLICY "Authors can delete their own boarding house reviews"
  ON boarding_house_reviews
  FOR DELETE
  TO authenticated
  USING (author_id = (select auth.uid()));

CREATE POLICY "Admins can manage boarding house reviews"
  ON boarding_house_reviews
  FOR ALL
  TO authenticated
  USING (public.has_app_role('admin'))
  WITH CHECK (public.has_app_role('admin'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'boarding-house-photos',
    'boarding-house-photos',
    false,
    5242880,
    ARRAY['image/png', 'image/jpeg', 'image/webp']
  ),
  (
    'boarding-house-verification',
    'boarding-house-verification',
    false,
    10485760,
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
  )
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Owners and admins can read boarding house listing photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'boarding-house-photos'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT listing.id::text
        FROM boarding_house_listings listing
        JOIN owner_profiles owner_profile ON owner_profile.id = listing.owner_id
        WHERE owner_profile.user_id = (select auth.uid())
      )
      OR public.has_app_role('admin')
    )
  );

CREATE POLICY "Owners can upload boarding house listing photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'boarding-house-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT listing.id::text
      FROM boarding_house_listings listing
      JOIN owner_profiles owner_profile ON owner_profile.id = listing.owner_id
      WHERE owner_profile.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Owners can manage their boarding house listing photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'boarding-house-photos'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT listing.id::text
        FROM boarding_house_listings listing
        JOIN owner_profiles owner_profile ON owner_profile.id = listing.owner_id
        WHERE owner_profile.user_id = (select auth.uid())
      )
      OR public.has_app_role('admin')
    )
  )
  WITH CHECK (bucket_id = 'boarding-house-photos');

CREATE POLICY "Owners can delete their boarding house listing photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'boarding-house-photos'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT listing.id::text
        FROM boarding_house_listings listing
        JOIN owner_profiles owner_profile ON owner_profile.id = listing.owner_id
        WHERE owner_profile.user_id = (select auth.uid())
      )
      OR public.has_app_role('admin')
    )
  );

CREATE POLICY "Owners can upload private verification documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'boarding-house-verification'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "Owners can read their own private verification documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'boarding-house-verification'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR public.has_app_role('admin')
    )
  );

-- Harden legacy admin-managed tables that previously trusted any authenticated user
-- or user-editable auth metadata. Each table is guarded with to_regclass so the
-- migration applies cleanly even where a given legacy table was never created.
DO $$ BEGIN
  IF to_regclass('public.facilities') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can manage facilities" ON facilities;
    DROP POLICY IF EXISTS "Admins can manage facilities" ON facilities;
    CREATE POLICY "Admins can manage facilities" ON facilities
      FOR ALL TO authenticated
      USING (public.has_app_role('admin')) WITH CHECK (public.has_app_role('admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.rooms') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can manage rooms" ON rooms;
    DROP POLICY IF EXISTS "Admins can manage rooms" ON rooms;
    CREATE POLICY "Admins can manage rooms" ON rooms
      FOR ALL TO authenticated
      USING (public.has_app_role('admin')) WITH CHECK (public.has_app_role('admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.submissions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Public read access for submissions" ON submissions;
    DROP POLICY IF EXISTS "Authenticated users can manage submissions" ON submissions;
    DROP POLICY IF EXISTS "Admins can manage submissions" ON submissions;
    CREATE POLICY "Admins can manage submissions" ON submissions
      FOR ALL TO authenticated
      USING (public.has_app_role('admin')) WITH CHECK (public.has_app_role('admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.suggestions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can view suggestions" ON suggestions;
    DROP POLICY IF EXISTS "Authenticated users can update suggestions" ON suggestions;
    DROP POLICY IF EXISTS "Authenticated users can insert suggestions" ON suggestions;
    DROP POLICY IF EXISTS "Admins can view suggestions" ON suggestions;
    DROP POLICY IF EXISTS "Admins can update suggestions" ON suggestions;
    DROP POLICY IF EXISTS "Admins can insert suggestions" ON suggestions;
    CREATE POLICY "Admins can view suggestions" ON suggestions
      FOR SELECT TO authenticated USING (public.has_app_role('admin'));
    CREATE POLICY "Admins can update suggestions" ON suggestions
      FOR UPDATE TO authenticated
      USING (public.has_app_role('admin')) WITH CHECK (public.has_app_role('admin'));
    CREATE POLICY "Admins can insert suggestions" ON suggestions
      FOR INSERT TO authenticated WITH CHECK (public.has_app_role('admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.bug_reports') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can view bug reports" ON bug_reports;
    DROP POLICY IF EXISTS "Authenticated users can update bug reports" ON bug_reports;
    DROP POLICY IF EXISTS "Admins can view bug reports" ON bug_reports;
    DROP POLICY IF EXISTS "Admins can update bug reports" ON bug_reports;
    CREATE POLICY "Admins can view bug reports" ON bug_reports
      FOR SELECT TO authenticated USING (public.has_app_role('admin'));
    CREATE POLICY "Admins can update bug reports" ON bug_reports
      FOR UPDATE TO authenticated
      USING (public.has_app_role('admin')) WITH CHECK (public.has_app_role('admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.map_nodes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can insert nodes" ON map_nodes;
    DROP POLICY IF EXISTS "Authenticated users can update nodes" ON map_nodes;
    DROP POLICY IF EXISTS "Authenticated users can delete nodes" ON map_nodes;
    DROP POLICY IF EXISTS "Admins can insert nodes" ON map_nodes;
    DROP POLICY IF EXISTS "Admins can update nodes" ON map_nodes;
    DROP POLICY IF EXISTS "Admins can delete nodes" ON map_nodes;
    CREATE POLICY "Admins can insert nodes" ON map_nodes
      FOR INSERT TO authenticated WITH CHECK (public.has_app_role('admin'));
    CREATE POLICY "Admins can update nodes" ON map_nodes
      FOR UPDATE TO authenticated
      USING (public.has_app_role('admin')) WITH CHECK (public.has_app_role('admin'));
    CREATE POLICY "Admins can delete nodes" ON map_nodes
      FOR DELETE TO authenticated USING (public.has_app_role('admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.map_edges') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can insert edges" ON map_edges;
    DROP POLICY IF EXISTS "Authenticated users can update edges" ON map_edges;
    DROP POLICY IF EXISTS "Authenticated users can delete edges" ON map_edges;
    DROP POLICY IF EXISTS "Admins can insert edges" ON map_edges;
    DROP POLICY IF EXISTS "Admins can update edges" ON map_edges;
    DROP POLICY IF EXISTS "Admins can delete edges" ON map_edges;
    CREATE POLICY "Admins can insert edges" ON map_edges
      FOR INSERT TO authenticated WITH CHECK (public.has_app_role('admin'));
    CREATE POLICY "Admins can update edges" ON map_edges
      FOR UPDATE TO authenticated
      USING (public.has_app_role('admin')) WITH CHECK (public.has_app_role('admin'));
    CREATE POLICY "Admins can delete edges" ON map_edges
      FOR DELETE TO authenticated USING (public.has_app_role('admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins manage events" ON events;
    CREATE POLICY "Admins manage events" ON events
      FOR ALL TO authenticated
      USING (public.has_app_role('admin')) WITH CHECK (public.has_app_role('admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.event_suggestions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins manage suggestions" ON event_suggestions;
    CREATE POLICY "Admins manage suggestions" ON event_suggestions
      FOR ALL TO authenticated
      USING (public.has_app_role('admin')) WITH CHECK (public.has_app_role('admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.ai_knowledge_entries') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins manage knowledge entries" ON ai_knowledge_entries;
    CREATE POLICY "Admins manage knowledge entries" ON ai_knowledge_entries
      FOR ALL TO authenticated
      USING (public.has_app_role('admin')) WITH CHECK (public.has_app_role('admin'));
  END IF;
END $$;

DROP POLICY IF EXISTS "Authenticated upload smartmap-bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update smartmap-bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete smartmap-bucket" ON storage.objects;
CREATE POLICY "Admins upload smartmap-bucket objects"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'smartmap-bucket'
    AND public.has_app_role('admin')
  );

CREATE POLICY "Admins update smartmap-bucket objects"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'smartmap-bucket'
    AND public.has_app_role('admin')
  )
  WITH CHECK (
    bucket_id = 'smartmap-bucket'
    AND public.has_app_role('admin')
  );

CREATE POLICY "Admins delete smartmap-bucket objects"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'smartmap-bucket'
    AND public.has_app_role('admin')
  );

-- Atomic owner-application approval: upsert profile, grant role, mark approved (guarded).
CREATE OR REPLACE FUNCTION public.approve_owner_application(
  p_application_id UUID,
  p_reviewer_id UUID,
  p_reviewer_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app RECORD;
BEGIN
  SELECT * INTO app FROM public.owner_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF app.status <> 'pending' THEN RAISE EXCEPTION 'Application is already %', app.status; END IF;

  INSERT INTO public.owner_profiles (user_id, display_name, phone, email, verification_status)
  VALUES (app.user_id, app.display_name, app.phone, app.email, 'verified')
  ON CONFLICT (user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        verification_status = 'verified';

  INSERT INTO public.app_user_roles (user_id, role, granted_by)
  VALUES (app.user_id, 'boarding_house_owner', p_reviewer_id)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.owner_applications
  SET status = 'approved', reviewer_id = p_reviewer_id,
      reviewer_note = p_reviewer_note, decided_at = now()
  WHERE id = p_application_id;
END;
$$;

-- Atomic listing moderation with state guards + audit event.
CREATE OR REPLACE FUNCTION public.moderate_boarding_house_listing(
  p_listing_id UUID,
  p_action TEXT,
  p_actor_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing RECORD;
BEGIN
  SELECT * INTO listing FROM public.boarding_house_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;

  IF p_action = 'publish' THEN
    IF listing.status NOT IN ('pending_review','unpublished','suspended','draft') THEN
      RAISE EXCEPTION 'Cannot publish a listing in status %', listing.status;
    END IF;
    UPDATE public.boarding_house_listings
      SET status = 'published', verification_status = 'verified',
          published_at = now(), suspended_at = NULL, rejected_at = NULL
      WHERE id = p_listing_id;
  ELSIF p_action = 'reject' THEN
    UPDATE public.boarding_house_listings
      SET status = 'rejected', rejected_at = now()
      WHERE id = p_listing_id;
  ELSIF p_action = 'unpublish' THEN
    UPDATE public.boarding_house_listings
      SET status = 'unpublished'
      WHERE id = p_listing_id;
  ELSIF p_action = 'suspend' THEN
    UPDATE public.boarding_house_listings
      SET status = 'suspended', suspended_at = now()
      WHERE id = p_listing_id;
  ELSE
    RAISE EXCEPTION 'Unknown moderation action %', p_action;
  END IF;

  INSERT INTO public.boarding_house_moderation_events (listing_id, actor_id, event_type, note)
  VALUES (p_listing_id, p_actor_id, 'listing_' || p_action, p_note);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_owner_application(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.moderate_boarding_house_listing(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Schedule daily purge of expired verification documents when pg_cron is available.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'delete-expired-bh-verification-docs',
      '0 3 * * *',
      'SELECT public.delete_expired_verification_documents();'
    );
  END IF;
END $$;
