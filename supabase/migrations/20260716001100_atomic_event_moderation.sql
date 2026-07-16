CREATE OR REPLACE FUNCTION public.approve_event_suggestion(p_suggestion_id UUID)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_suggestion public.event_suggestions%ROWTYPE;
  v_event public.events%ROWTYPE;
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

  INSERT INTO public.events (
    title,
    description,
    start_time,
    end_time,
    location_text,
    location_id,
    category,
    image_url
  ) VALUES (
    v_suggestion.title,
    v_suggestion.description,
    v_suggestion.start_time,
    v_suggestion.end_time,
    v_suggestion.location_text,
    NULL,
    v_suggestion.category,
    NULL
  )
  RETURNING * INTO v_event;

  UPDATE public.event_suggestions
  SET status = 'approved',
      decided_at = v_decided_at,
      proof_retain_until = v_decided_at + interval '90 days'
  WHERE id = p_suggestion_id
    AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'suggestion unavailable';
  END IF;

  RETURN v_event;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_event_suggestion(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_event_suggestion(UUID)
  TO service_role;
