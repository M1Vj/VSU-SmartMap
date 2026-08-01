-- Private, server-written operational records for Campus Assistant chat.

CREATE TYPE public.ai_chat_outcome AS ENUM (
  'live',
  'cached',
  'recovered',
  'generated_fallback',
  'static_fallback',
  'disabled_fallback',
  'rate_limited',
  'validation_failed',
  'error',
  'synthetic'
);

CREATE TYPE public.ai_chat_review_status AS ENUM (
  'unreviewed',
  'reviewing',
  'resolved',
  'dismissed'
);

CREATE TYPE public.ai_chat_validation_status AS ENUM ('pass', 'warn', 'fail');

CREATE TABLE public.ai_chat_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  request_id TEXT NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 200),
  release_id TEXT NOT NULL CHECK (char_length(release_id) BETWEEN 1 AND 200),
  feedback_token_hash TEXT NOT NULL CHECK (char_length(feedback_token_hash) BETWEEN 32 AND 128),
  user_message TEXT NOT NULL CHECK (char_length(user_message) BETWEEN 1 AND 8000),
  assistant_message TEXT CHECK (assistant_message IS NULL OR char_length(assistant_message) <= 16000),
  outcome public.ai_chat_outcome NOT NULL,
  requested_model TEXT CHECK (requested_model IS NULL OR char_length(requested_model) BETWEEN 1 AND 200),
  selected_model TEXT CHECK (selected_model IS NULL OR char_length(selected_model) BETWEEN 1 AND 200),
  prompt_version TEXT CHECK (prompt_version IS NULL OR char_length(prompt_version) BETWEEN 1 AND 120),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 10),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms BETWEEN 0 AND 600000),
  time_to_first_token_ms INTEGER CHECK (time_to_first_token_ms IS NULL OR time_to_first_token_ms BETWEEN 0 AND 600000),
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens BETWEEN 0 AND 1000000),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens BETWEEN 0 AND 1000000),
  cache_state TEXT CHECK (cache_state IS NULL OR (char_length(cache_state) BETWEEN 1 AND 80)),
  retrieved_record_ids TEXT[] NOT NULL DEFAULT '{}'::TEXT[] CHECK (cardinality(retrieved_record_ids) <= 100),
  validation_status public.ai_chat_validation_status NOT NULL DEFAULT 'pass',
  validation_reasons TEXT[] NOT NULL DEFAULT '{}'::TEXT[] CHECK (cardinality(validation_reasons) <= 20),
  injection_signals TEXT[] NOT NULL DEFAULT '{}'::TEXT[] CHECK (cardinality(injection_signals) <= 20),
  error_class TEXT CHECK (error_class IS NULL OR char_length(error_class) BETWEEN 1 AND 120),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
  review_status public.ai_chat_review_status NOT NULL DEFAULT 'unreviewed',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note TEXT CHECK (review_note IS NULL OR char_length(review_note) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_chat_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turn_id UUID NOT NULL REFERENCES public.ai_chat_turns(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
  reason TEXT CHECK (reason IS NULL OR reason IN ('incorrect', 'outdated', 'wrong_location', 'unhelpful', 'unsafe', 'other')),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 1000),
  review_status public.ai_chat_review_status NOT NULL DEFAULT 'unreviewed',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note TEXT CHECK (review_note IS NULL OR char_length(review_note) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (turn_id),
  CHECK ((rating = 'negative' AND reason IS NOT NULL) OR (rating = 'positive' AND reason IS NULL))
);

CREATE TABLE public.ai_chat_alert_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL CHECK (char_length(fingerprint) BETWEEN 1 AND 240),
  bucket_start TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fingerprint, bucket_start)
);

CREATE INDEX ai_chat_turns_created_at_idx ON public.ai_chat_turns (created_at DESC);
CREATE INDEX ai_chat_turns_outcome_created_at_idx ON public.ai_chat_turns (outcome, created_at DESC);
CREATE INDEX ai_chat_turns_release_created_at_idx ON public.ai_chat_turns (release_id, created_at DESC);
CREATE INDEX ai_chat_turns_review_created_at_idx ON public.ai_chat_turns (review_status, created_at DESC);
CREATE INDEX ai_chat_turns_reviewed_by_idx ON public.ai_chat_turns (reviewed_by);
CREATE INDEX ai_chat_feedback_created_at_idx ON public.ai_chat_feedback (created_at DESC);
CREATE INDEX ai_chat_feedback_rating_created_at_idx ON public.ai_chat_feedback (rating, created_at DESC);
CREATE INDEX ai_chat_feedback_reviewed_by_idx ON public.ai_chat_feedback (reviewed_by);
CREATE INDEX ai_chat_alert_claims_created_at_idx ON public.ai_chat_alert_claims (created_at DESC);

CREATE TRIGGER update_ai_chat_turns_updated_at
  BEFORE UPDATE ON public.ai_chat_turns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_chat_feedback_updated_at
  BEFORE UPDATE ON public.ai_chat_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ai_chat_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_alert_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read chat turns"
  ON public.ai_chat_turns FOR SELECT TO authenticated
  USING (public.has_app_role('admin'));

CREATE POLICY "Admins review chat turns"
  ON public.ai_chat_turns FOR UPDATE TO authenticated
  USING (public.has_app_role('admin'))
  WITH CHECK (public.has_app_role('admin'));

CREATE POLICY "Admins read chat feedback"
  ON public.ai_chat_feedback FOR SELECT TO authenticated
  USING (public.has_app_role('admin'));

CREATE POLICY "Admins review chat feedback"
  ON public.ai_chat_feedback FOR UPDATE TO authenticated
  USING (public.has_app_role('admin'))
  WITH CHECK (public.has_app_role('admin'));

REVOKE ALL ON TABLE public.ai_chat_turns, public.ai_chat_feedback, public.ai_chat_alert_claims
  FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.ai_chat_turns, public.ai_chat_feedback, public.ai_chat_alert_claims
  TO service_role;
GRANT SELECT ON TABLE public.ai_chat_turns, public.ai_chat_feedback TO authenticated;
GRANT UPDATE (review_status, reviewed_at, reviewed_by, review_note) ON public.ai_chat_turns TO authenticated;
GRANT UPDATE (review_status, reviewed_at, reviewed_by, review_note) ON public.ai_chat_feedback TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_ai_chat_alert(
  p_fingerprint TEXT,
  p_occurred_at TIMESTAMPTZ DEFAULT now(),
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  IF char_length(p_fingerprint) NOT BETWEEN 1 AND 240 THEN
    RAISE EXCEPTION 'invalid alert fingerprint';
  END IF;
  IF jsonb_typeof(p_metadata) <> 'object' THEN
    RAISE EXCEPTION 'invalid alert metadata';
  END IF;

  INSERT INTO public.ai_chat_alert_claims (fingerprint, bucket_start, metadata, created_at)
  VALUES (
    p_fingerprint,
    date_bin(interval '15 minutes', p_occurred_at, TIMESTAMPTZ '2000-01-01 00:00:00+00'),
    p_metadata,
    p_occurred_at
  )
  ON CONFLICT (fingerprint, bucket_start) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_ai_chat_ops(
  p_now TIMESTAMPTZ DEFAULT now(),
  p_batch_size INTEGER DEFAULT 1000
)
RETURNS TABLE (feedback_deleted INTEGER, turns_deleted INTEGER, alert_claims_deleted INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_batch_size NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'batch size must be between 1 and 5000';
  END IF;

  WITH expired AS (
    SELECT feedback.id
    FROM public.ai_chat_feedback AS feedback
    WHERE feedback.created_at < p_now - interval '90 days'
    ORDER BY feedback.created_at
    LIMIT p_batch_size
  )
  DELETE FROM public.ai_chat_feedback AS feedback
  USING expired
  WHERE feedback.id = expired.id;
  GET DIAGNOSTICS feedback_deleted = ROW_COUNT;

  WITH expired AS (
    SELECT turn_record.id
    FROM public.ai_chat_turns AS turn_record
    WHERE turn_record.created_at < p_now - interval '90 days'
    ORDER BY turn_record.created_at
    LIMIT p_batch_size
  )
  DELETE FROM public.ai_chat_turns AS turn_record
  USING expired
  WHERE turn_record.id = expired.id;
  GET DIAGNOSTICS turns_deleted = ROW_COUNT;

  WITH expired AS (
    SELECT claim.id
    FROM public.ai_chat_alert_claims AS claim
    WHERE claim.created_at < p_now - interval '30 days'
    ORDER BY claim.created_at
    LIMIT p_batch_size
  )
  DELETE FROM public.ai_chat_alert_claims AS claim
  USING expired
  WHERE claim.id = expired.id;
  GET DIAGNOSTICS alert_claims_deleted = ROW_COUNT;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ai_chat_alert(TEXT, TIMESTAMPTZ, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_ai_chat_alert(TEXT, TIMESTAMPTZ, JSONB)
  TO service_role;
REVOKE ALL ON FUNCTION public.purge_ai_chat_ops(TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_ai_chat_ops(TIMESTAMPTZ, INTEGER)
  TO service_role;

ALTER TABLE public.notification_recipients
  ALTER COLUMN event_types SET DEFAULT ARRAY[
    'owner_application_submitted',
    'owner_application_approved',
    'boarding_house_listing_submitted',
    'boarding_house_listing_updated',
    'boarding_house_report_submitted',
    'suggestion_submitted',
    'chat_ops_alert'
  ]::TEXT[];

UPDATE public.notification_recipients
SET event_types = array_append(event_types, 'chat_ops_alert')
WHERE NOT ('chat_ops_alert' = ANY (event_types));
