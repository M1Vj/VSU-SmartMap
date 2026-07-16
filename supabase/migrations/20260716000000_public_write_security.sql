-- Durable, privacy-preserving fixed-window limits for anonymous public writes.

CREATE TABLE public.security_rate_limit_buckets (
  scope TEXT NOT NULL CHECK (
    char_length(scope) BETWEEN 1 AND 64
    AND scope ~ '^[a-z][a-z0-9:_-]*$'
  ),
  subject_hash TEXT NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  byte_count BIGINT NOT NULL DEFAULT 0 CHECK (byte_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, subject_hash, window_start)
);

CREATE INDEX security_rate_limit_buckets_window_start_idx
  ON public.security_rate_limit_buckets (window_start);

ALTER TABLE public.security_rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- The table is intentionally inaccessible through PostgREST, including to the
-- service role. The SECURITY DEFINER functions below are the only entry points.
REVOKE ALL ON TABLE public.security_rate_limit_buckets
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_security_rate_limit(
  p_scope TEXT,
  p_subject_hash TEXT,
  p_request_limit INTEGER,
  p_byte_limit BIGINT,
  p_window_seconds INTEGER,
  p_cost_bytes BIGINT
)
RETURNS TABLE (allowed BOOLEAN, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_window_start TIMESTAMPTZ;
  v_request_count INTEGER;
  v_byte_count BIGINT;
  v_allowed BOOLEAN;
  v_retry_after_seconds INTEGER;
BEGIN
  IF p_scope IS NULL
    OR char_length(p_scope) NOT BETWEEN 1 AND 64
    OR p_scope !~ '^[a-z][a-z0-9:_-]*$'
    OR p_subject_hash IS NULL
    OR p_subject_hash !~ '^[0-9a-f]{64}$'
    OR p_request_limit IS NULL
    OR p_request_limit NOT BETWEEN 1 AND 10000
    OR (p_byte_limit IS NOT NULL AND p_byte_limit NOT BETWEEN 1 AND 100000000)
    OR p_window_seconds IS NULL
    OR p_window_seconds NOT BETWEEN 1 AND 86400
    OR p_cost_bytes IS NULL
    OR p_cost_bytes NOT BETWEEN 0 AND 100000000
  THEN
    RAISE EXCEPTION 'invalid rate-limit parameters' USING ERRCODE = '22023';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.security_rate_limit_buckets (
    scope,
    subject_hash,
    window_start,
    request_count,
    byte_count,
    created_at,
    updated_at
  )
  VALUES (
    p_scope,
    p_subject_hash,
    v_window_start,
    1,
    p_cost_bytes,
    v_now,
    v_now
  )
  ON CONFLICT (scope, subject_hash, window_start) DO UPDATE
  SET request_count = public.security_rate_limit_buckets.request_count + 1,
      byte_count = public.security_rate_limit_buckets.byte_count + EXCLUDED.byte_count,
      updated_at = EXCLUDED.updated_at
  RETURNING request_count, byte_count
  INTO v_request_count, v_byte_count;

  v_allowed := v_request_count <= p_request_limit
    AND (p_byte_limit IS NULL OR v_byte_count <= p_byte_limit);
  v_retry_after_seconds := CASE
    WHEN v_allowed THEN 0
    ELSE greatest(
      1,
      ceil(extract(epoch FROM (
        v_window_start + make_interval(secs => p_window_seconds) - v_now
      )))::INTEGER
    )
  END;

  RETURN QUERY SELECT v_allowed, v_retry_after_seconds;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_security_rate_limit(
  TEXT, TEXT, INTEGER, BIGINT, INTEGER, BIGINT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_security_rate_limit(
  TEXT, TEXT, INTEGER, BIGINT, INTEGER, BIGINT
) TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_security_rate_limit_buckets(
  p_older_than INTERVAL DEFAULT INTERVAL '2 days'
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted BIGINT;
BEGIN
  IF p_older_than IS NULL
    OR p_older_than < INTERVAL '1 hour'
    OR p_older_than > INTERVAL '30 days'
  THEN
    RAISE EXCEPTION 'invalid cleanup interval' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.security_rate_limit_buckets
  WHERE window_start < clock_timestamp() - p_older_than;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_security_rate_limit_buckets(INTERVAL)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_security_rate_limit_buckets(INTERVAL)
  TO service_role;
