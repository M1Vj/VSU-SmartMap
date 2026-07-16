-- Make submitted event evidence private while preserving legacy URL rows for a
-- bounded dual-read migration window. This migration does not delete evidence.

ALTER TABLE public.event_suggestions
  ADD COLUMN IF NOT EXISTS proof_object_path TEXT,
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proof_retain_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proof_deleted_at TIMESTAMPTZ;

ALTER TABLE public.event_suggestions
  ALTER COLUMN proof_file_url DROP NOT NULL;

ALTER TABLE public.event_suggestions
  DROP CONSTRAINT IF EXISTS event_suggestions_proof_object_path_check;
ALTER TABLE public.event_suggestions
  ADD CONSTRAINT event_suggestions_proof_object_path_check CHECK (
    proof_object_path IS NULL OR
    proof_object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  );

CREATE INDEX IF NOT EXISTS idx_event_suggestions_proof_retention
  ON public.event_suggestions (proof_retain_until)
  WHERE proof_object_path IS NOT NULL AND proof_deleted_at IS NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-proofs', 'event-proofs', false, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read event-proofs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload event-proofs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update event-proofs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete event-proofs" ON storage.objects;

ALTER TABLE public.pending_suggestion_uploads
  DROP CONSTRAINT IF EXISTS pending_suggestion_uploads_bucket_check;
ALTER TABLE public.pending_suggestion_uploads
  DROP CONSTRAINT IF EXISTS pending_suggestion_uploads_object_path_check;
ALTER TABLE public.pending_suggestion_uploads
  ADD CONSTRAINT pending_suggestion_uploads_bucket_check CHECK (
    (kind = 'map-suggestion-image' AND bucket = 'smartmap-bucket') OR
    (kind = 'event-proof' AND bucket IN ('smartmap-bucket', 'event-proofs'))
  );
ALTER TABLE public.pending_suggestion_uploads
  ADD CONSTRAINT pending_suggestion_uploads_object_path_check CHECK (
    (kind = 'map-suggestion-image' AND
      object_path ~ '^suggestion-images/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$') OR
    (kind = 'event-proof' AND bucket = 'event-proofs' AND
      object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$') OR
    (kind = 'event-proof' AND bucket = 'smartmap-bucket' AND
      object_path ~ '^event-proofs/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$')
  );

DROP FUNCTION IF EXISTS public.submit_event_suggestion(
  TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT,
  public.event_category, TEXT
);

CREATE OR REPLACE FUNCTION public.submit_event_suggestion(
  p_owner_hash TEXT,
  p_upload_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_location_text TEXT,
  p_category public.event_category
)
RETURNS public.event_suggestions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_upload public.pending_suggestion_uploads%ROWTYPE;
  v_result public.event_suggestions%ROWTYPE;
BEGIN
  IF p_owner_hash IS NULL OR p_owner_hash !~ '^[0-9a-f]{64}$'
     OR p_title IS NULL OR btrim(p_title) = '' OR length(p_title) > 200
     OR length(COALESCE(p_description, '')) > 4000
     OR length(COALESCE(p_location_text, '')) > 300
     OR p_start_time IS NULL OR p_end_time IS NULL OR p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'invalid submission';
  END IF;

  SELECT * INTO v_upload
  FROM public.pending_suggestion_uploads
  WHERE id = p_upload_id
    AND kind = 'event-proof'
    AND bucket = 'event-proofs'
    AND owner_hash = p_owner_hash
    AND claimed_at IS NULL
    AND expires_at > statement_timestamp()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid submission';
  END IF;

  UPDATE public.pending_suggestion_uploads
  SET claimed_at = statement_timestamp()
  WHERE id = v_upload.id;

  INSERT INTO public.event_suggestions (
    title, description, start_time, end_time, location_text, category,
    proof_file_url, proof_object_path, status, submitted_by
  ) VALUES (
    btrim(p_title), NULLIF(btrim(p_description), ''), p_start_time, p_end_time,
    NULLIF(btrim(p_location_text), ''), p_category,
    NULL, v_upload.object_path, 'pending', NULL
  )
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_event_suggestion(
  TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT,
  public.event_category
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_event_suggestion(
  TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT,
  public.event_category
) TO service_role;
