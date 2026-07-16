ALTER TABLE public.event_suggestions
  ADD COLUMN IF NOT EXISTS proof_deletion_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proof_deletion_claim_token UUID;

ALTER TABLE public.event_suggestions
  DROP CONSTRAINT IF EXISTS event_suggestions_proof_deletion_claim_check;
ALTER TABLE public.event_suggestions
  ADD CONSTRAINT event_suggestions_proof_deletion_claim_check CHECK (
    (proof_deletion_started_at IS NULL) = (proof_deletion_claim_token IS NULL)
  );

CREATE OR REPLACE FUNCTION public.reject_event_suggestion(p_suggestion_id UUID)
RETURNS public.event_suggestions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_suggestion public.event_suggestions%ROWTYPE;
  v_decided_at TIMESTAMPTZ := statement_timestamp();
BEGIN
  IF p_suggestion_id IS NULL THEN
    RAISE EXCEPTION 'suggestion unavailable';
  END IF;

  SELECT * INTO v_suggestion
  FROM public.event_suggestions
  WHERE id = p_suggestion_id
    AND status = 'pending'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'suggestion unavailable';
  END IF;

  UPDATE public.event_suggestions
  SET status = 'rejected',
      decided_at = v_decided_at,
      proof_retain_until = v_decided_at + interval '30 days'
  WHERE id = p_suggestion_id
    AND status = 'pending'
  RETURNING * INTO v_suggestion;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'suggestion unavailable';
  END IF;

  RETURN v_suggestion;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_expired_event_proofs(
  p_now TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 100,
  p_lease_seconds INTEGER DEFAULT 900
)
RETURNS TABLE (id UUID, proof_object_path TEXT, claim_token UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_now IS NULL OR p_limit < 1 OR p_limit > 100 OR
     p_lease_seconds < 60 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'invalid proof deletion claim';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT suggestion.id
    FROM public.event_suggestions AS suggestion
    WHERE suggestion.proof_object_path IS NOT NULL
      AND suggestion.proof_retain_until < p_now
      AND suggestion.proof_deleted_at IS NULL
      AND (
        suggestion.proof_deletion_started_at IS NULL OR
        suggestion.proof_deletion_started_at <
          p_now - pg_catalog.make_interval(secs => p_lease_seconds)
      )
    ORDER BY suggestion.proof_retain_until, suggestion.id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.event_suggestions AS suggestion
  SET proof_deletion_started_at = p_now,
      proof_deletion_claim_token = pg_catalog.gen_random_uuid()
  FROM candidates
  WHERE suggestion.id = candidates.id
  RETURNING suggestion.id,
            suggestion.proof_object_path,
            suggestion.proof_deletion_claim_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_event_proof_deletion(
  p_suggestion_id UUID,
  p_claim_token UUID,
  p_deleted_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_suggestion_id IS NULL OR p_claim_token IS NULL OR p_deleted_at IS NULL THEN
    RETURN false;
  END IF;
  UPDATE public.event_suggestions
  SET proof_deleted_at = p_deleted_at,
      proof_deletion_started_at = NULL,
      proof_deletion_claim_token = NULL
  WHERE id = p_suggestion_id
    AND proof_deleted_at IS NULL
    AND proof_deletion_claim_token = p_claim_token;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_event_proof_deletion(
  p_suggestion_id UUID,
  p_claim_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_suggestion_id IS NULL OR p_claim_token IS NULL THEN
    RETURN false;
  END IF;
  UPDATE public.event_suggestions
  SET proof_deletion_started_at = NULL,
      proof_deletion_claim_token = NULL
  WHERE id = p_suggestion_id
    AND proof_deleted_at IS NULL
    AND proof_deletion_claim_token = p_claim_token;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_event_suggestion(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_event_suggestion(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.claim_expired_event_proofs(TIMESTAMPTZ, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_expired_event_proofs(TIMESTAMPTZ, INTEGER, INTEGER)
  TO service_role;

REVOKE ALL ON FUNCTION public.complete_event_proof_deletion(UUID, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_event_proof_deletion(UUID, UUID, TIMESTAMPTZ)
  TO service_role;

REVOKE ALL ON FUNCTION public.release_event_proof_deletion(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_event_proof_deletion(UUID, UUID)
  TO service_role;
