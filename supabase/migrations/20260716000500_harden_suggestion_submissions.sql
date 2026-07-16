CREATE TABLE public.pending_suggestion_uploads (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('map-suggestion-image', 'event-proof')),
  bucket TEXT NOT NULL CHECK (bucket = 'smartmap-bucket'),
  object_path TEXT NOT NULL UNIQUE CHECK (
    object_path ~ '^(suggestion-images|event-proofs)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ),
  owner_hash TEXT NOT NULL CHECK (owner_hash ~ '^[0-9a-f]{64}$'),
  bytes BIGINT NOT NULL CHECK (bytes > 0 AND bytes <= 5242880),
  verified_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > verified_at),
  CHECK (claimed_at IS NULL OR claimed_at >= verified_at)
);

ALTER TABLE public.pending_suggestion_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pending_suggestion_uploads FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pending_suggestion_uploads TO service_role;

DROP POLICY IF EXISTS "Public can submit suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Users create suggestions" ON public.event_suggestions;
DROP POLICY IF EXISTS "Public upload suggestion images" ON storage.objects;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.suggestions FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.event_suggestions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_map_suggestion(
  p_owner_hash TEXT,
  p_upload_id UUID,
  p_type public.suggestion_type,
  p_target_id UUID,
  p_payload JSONB,
  p_public_storage_base_url TEXT
)
RETURNS public.suggestions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_upload public.pending_suggestion_uploads%ROWTYPE;
  v_payload JSONB;
  v_result public.suggestions%ROWTYPE;
BEGIN
  IF p_owner_hash IS NULL OR p_owner_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid submission';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR octet_length(p_payload::TEXT) > 32768 THEN
    RAISE EXCEPTION 'invalid submission';
  END IF;
  IF length(COALESCE(p_payload->>'name', '')) > 120
     OR length(COALESCE(p_payload->>'description', '')) > 400
     OR length(COALESCE(p_payload->>'roomCode', '')) > 16
     OR length(COALESCE(p_payload->>'imageCredit', '')) > 80 THEN
    RAISE EXCEPTION 'invalid submission';
  END IF;
  IF (p_type = 'ADD_FACILITY' AND p_target_id IS NOT NULL)
     OR (p_type <> 'ADD_FACILITY' AND p_target_id IS NULL) THEN
    RAISE EXCEPTION 'invalid submission';
  END IF;
  IF (p_payload ? 'status') OR (p_payload ? 'adminNote') OR (p_payload ? 'proofFileUrl') THEN
    RAISE EXCEPTION 'invalid submission';
  END IF;

  v_payload := p_payload - 'status' - 'adminNote' - 'proofFileUrl' - 'uploadId';
  IF p_upload_id IS NULL THEN
    IF v_payload ? 'imageUrl' AND v_payload->'imageUrl' <> 'null'::JSONB THEN
      RAISE EXCEPTION 'invalid submission';
    END IF;
  ELSE
    SELECT * INTO v_upload
    FROM public.pending_suggestion_uploads
    WHERE id = p_upload_id
      AND kind = 'map-suggestion-image'
      AND owner_hash = p_owner_hash
      AND claimed_at IS NULL
      AND expires_at > statement_timestamp()
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid submission';
    END IF;
    IF p_public_storage_base_url !~ '^https://[a-z0-9.-]+$' THEN
      RAISE EXCEPTION 'invalid submission';
    END IF;
    v_payload := jsonb_set(
      v_payload,
      '{imageUrl}',
      to_jsonb(
        rtrim(p_public_storage_base_url, '/') ||
        '/storage/v1/object/public/' || v_upload.bucket || '/' || v_upload.object_path
      )
    );
    UPDATE public.pending_suggestion_uploads
    SET claimed_at = statement_timestamp()
    WHERE id = v_upload.id;
  END IF;

  INSERT INTO public.suggestions (type, status, target_id, payload, admin_note)
  VALUES (p_type, 'PENDING', p_target_id, v_payload, NULL)
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_event_suggestion(
  p_owner_hash TEXT,
  p_upload_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_location_text TEXT,
  p_category public.event_category,
  p_public_storage_base_url TEXT
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
     OR p_start_time IS NULL OR p_end_time IS NULL OR p_end_time <= p_start_time
     OR p_public_storage_base_url !~ '^https://[a-z0-9.-]+$' THEN
    RAISE EXCEPTION 'invalid submission';
  END IF;

  SELECT * INTO v_upload
  FROM public.pending_suggestion_uploads
  WHERE id = p_upload_id
    AND kind = 'event-proof'
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
    proof_file_url, status, submitted_by
  ) VALUES (
    btrim(p_title), NULLIF(btrim(p_description), ''), p_start_time, p_end_time,
    NULLIF(btrim(p_location_text), ''), p_category,
    rtrim(p_public_storage_base_url, '/') ||
      '/storage/v1/object/public/' || v_upload.bucket || '/' || v_upload.object_path,
    'pending', NULL
  )
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_map_suggestion(TEXT, UUID, public.suggestion_type, UUID, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_map_suggestion(TEXT, UUID, public.suggestion_type, UUID, JSONB, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.submit_event_suggestion(TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, public.event_category, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_event_suggestion(TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, public.event_category, TEXT)
  TO service_role;
