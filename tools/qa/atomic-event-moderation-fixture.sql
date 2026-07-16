\set ON_ERROR_STOP on

\ir private-event-proofs-fixture.sql

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location_text TEXT,
  location_id UUID,
  category public.event_category NOT NULL DEFAULT 'other',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()
);

\ir ../../supabase/migrations/20260716001100_atomic_event_moderation.sql

CREATE FUNCTION public.fixture_reject_moderation_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'fixture rejects moderation update';
END;
$$;

CREATE TRIGGER fixture_reject_moderation_update
BEFORE UPDATE ON public.event_suggestions
FOR EACH ROW
WHEN (OLD.title = 'Atomic rollback fixture')
EXECUTE FUNCTION public.fixture_reject_moderation_update();

DO $$
DECLARE
  v_id UUID;
  v_event public.events%ROWTYPE;
  v_status public.event_suggestion_status;
  v_decided_at TIMESTAMPTZ;
  v_retain_until TIMESTAMPTZ;
BEGIN
  IF has_function_privilege(
    'anon', 'public.approve_event_suggestion(uuid)', 'EXECUTE'
  ) OR has_function_privilege(
    'authenticated', 'public.approve_event_suggestion(uuid)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'API roles can execute approval';
  END IF;
  IF NOT has_function_privilege(
    'service_role', 'public.approve_event_suggestion(uuid)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service role cannot execute approval';
  END IF;

  INSERT INTO public.event_suggestions (
    title, start_time, end_time, category, proof_object_path
  ) VALUES (
    'Atomic rollback fixture',
    statement_timestamp() + interval '1 day',
    statement_timestamp() + interval '2 days',
    'academic',
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8/7ba7b810-9dad-11d1-80b4-00c04fd430c9.webp'
  ) RETURNING id INTO v_id;

  BEGIN
    PERFORM public.approve_event_suggestion(v_id);
    RAISE EXCEPTION 'approval unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'approval unexpectedly succeeded' THEN
        RAISE;
      END IF;
  END;

  IF EXISTS (SELECT 1 FROM public.events WHERE title = 'Atomic rollback fixture') THEN
    RAISE EXCEPTION 'event insert survived a failed moderation update';
  END IF;
  SELECT status, decided_at, proof_retain_until
  INTO v_status, v_decided_at, v_retain_until
  FROM public.event_suggestions WHERE id = v_id;
  IF v_status <> 'pending' OR v_decided_at IS NOT NULL OR v_retain_until IS NOT NULL THEN
    RAISE EXCEPTION 'failed approval changed suggestion state';
  END IF;

  EXECUTE 'DROP TRIGGER fixture_reject_moderation_update ON public.event_suggestions';
  SELECT * INTO v_event FROM public.approve_event_suggestion(v_id);
  IF v_event.image_url IS NOT NULL THEN
    RAISE EXCEPTION 'proof evidence became a public event image';
  END IF;
  SELECT status, decided_at, proof_retain_until
  INTO v_status, v_decided_at, v_retain_until
  FROM public.event_suggestions WHERE id = v_id;
  IF v_status <> 'approved' OR v_decided_at IS NULL OR
     v_retain_until <> v_decided_at + interval '90 days' THEN
    RAISE EXCEPTION 'successful approval did not set retention atomically';
  END IF;

  BEGIN
    PERFORM public.approve_event_suggestion(v_id);
    RAISE EXCEPTION 'duplicate approval unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'duplicate approval unexpectedly succeeded' THEN
        RAISE;
      END IF;
  END;
  IF (SELECT count(*) FROM public.events WHERE title = 'Atomic rollback fixture') <> 1 THEN
    RAISE EXCEPTION 'retry created a duplicate event';
  END IF;
END;
$$;

SELECT 'atomic event moderation fixture passed' AS result;
