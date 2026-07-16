\set ON_ERROR_STOP on

\ir atomic-event-moderation-fixture.sql
\ir ../../supabase/migrations/20260716001200_event_proof_lifecycle_races.sql

DO $$
DECLARE
  v_approved_id UUID;
  v_approved_retain TIMESTAMPTZ;
  v_due_id UUID;
  v_extended_id UUID;
  v_claim RECORD;
  v_old_token UUID := '9ba7b810-9dad-11d1-80b4-00c04fd430cb';
  v_now TIMESTAMPTZ := '2026-08-01T00:00:00.000Z';
BEGIN
  SELECT id, proof_retain_until INTO v_approved_id, v_approved_retain
  FROM public.event_suggestions
  WHERE title = 'Atomic rollback fixture';

  BEGIN
    PERFORM public.reject_event_suggestion(v_approved_id);
    RAISE EXCEPTION 'stale rejection unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'stale rejection unexpectedly succeeded' THEN
        RAISE;
      END IF;
  END;
  IF NOT EXISTS (
    SELECT 1 FROM public.event_suggestions
    WHERE id = v_approved_id
      AND status = 'approved'
      AND proof_retain_until = v_approved_retain
  ) OR (SELECT count(*) FROM public.events WHERE title = 'Atomic rollback fixture') <> 1 THEN
    RAISE EXCEPTION 'stale rejection changed approved state or event count';
  END IF;

  INSERT INTO public.event_suggestions (
    title, start_time, end_time, category, proof_object_path,
    status, decided_at, proof_retain_until
  ) VALUES (
    'Due lifecycle fixture', v_now, v_now + interval '1 hour', 'academic',
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8/7ba7b810-9dad-11d1-80b4-00c04fd430c9.webp',
    'rejected', v_now - interval '31 days', v_now - interval '1 day'
  ) RETURNING id INTO v_due_id;

  INSERT INTO public.event_suggestions (
    title, start_time, end_time, category, proof_object_path,
    status, decided_at, proof_retain_until
  ) VALUES (
    'Extended lifecycle fixture', v_now, v_now + interval '1 hour', 'academic',
    '550e8400-e29b-41d4-a716-446655440000/7ba7b810-9dad-11d1-80b4-00c04fd430c9.webp',
    'rejected', v_now - interval '31 days', v_now + interval '1 day'
  ) RETURNING id INTO v_extended_id;

  SELECT * INTO v_claim
  FROM public.claim_expired_event_proofs(v_now, 1, 900);
  IF v_claim.id <> v_due_id OR v_claim.claim_token IS NULL THEN
    RAISE EXCEPTION 'due proof was not claimed deterministically';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.event_suggestions
    WHERE id = v_extended_id AND proof_deletion_started_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'extended proof was claimed';
  END IF;
  IF public.complete_event_proof_deletion(v_due_id, gen_random_uuid(), v_now) THEN
    RAISE EXCEPTION 'mismatched claim completed deletion';
  END IF;
  IF public.release_event_proof_deletion(v_due_id, gen_random_uuid()) THEN
    RAISE EXCEPTION 'mismatched claim released deletion';
  END IF;
  IF NOT public.release_event_proof_deletion(v_due_id, v_claim.claim_token) THEN
    RAISE EXCEPTION 'matching claim could not be released';
  END IF;

  UPDATE public.event_suggestions
  SET proof_deletion_started_at = v_now - interval '16 minutes',
      proof_deletion_claim_token = v_old_token
  WHERE id = v_due_id;
  SELECT * INTO v_claim
  FROM public.claim_expired_event_proofs(v_now, 1, 900);
  IF v_claim.id <> v_due_id OR v_claim.claim_token = v_old_token THEN
    RAISE EXCEPTION 'stale claim was not recovered with a new token';
  END IF;
  IF NOT public.complete_event_proof_deletion(v_due_id, v_claim.claim_token, v_now) THEN
    RAISE EXCEPTION 'matching claim could not complete deletion';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.event_suggestions
    WHERE id = v_due_id
      AND proof_deleted_at = v_now
      AND proof_deletion_started_at IS NULL
      AND proof_deletion_claim_token IS NULL
  ) THEN
    RAISE EXCEPTION 'completed deletion state is inconsistent';
  END IF;
END;
$$;

SELECT 'event proof lifecycle race fixture passed' AS result;
