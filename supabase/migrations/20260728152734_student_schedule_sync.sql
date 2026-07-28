DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'student_schedule_mutator'
  ) THEN
    EXECUTE 'CREATE ROLE student_schedule_mutator NOLOGIN NOINHERIT';
  END IF;
END $$;

GRANT student_schedule_mutator TO postgres;

CREATE SEQUENCE public.student_schedule_server_version_seq AS BIGINT;

CREATE TABLE public.student_schedule_courses (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  id UUID NOT NULL,
  payload JSONB,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  server_version BIGINT NOT NULL
    DEFAULT nextval('public.student_schedule_server_version_seq'::regclass)
    CHECK (server_version > 0),
  last_mutation_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, id),
  CONSTRAINT student_schedule_courses_payload_state_check CHECK (
    (
      deleted_at IS NULL
      AND payload IS NOT NULL
      AND jsonb_typeof(payload) = 'object'
      AND payload ->> 'id' = id::text
      AND octet_length(payload::text) <= 32768
    )
    OR (deleted_at IS NOT NULL AND payload IS NULL)
  )
);

CREATE INDEX student_schedule_courses_pull_idx
  ON public.student_schedule_courses (user_id, server_version, id);

CREATE FUNCTION public.enforce_student_schedule_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_active_count INTEGER;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.user_id::text, 0)
  );

  IF TG_OP = 'INSERT' THEN
    NEW.revision := 1;
    NEW.server_version := nextval('public.student_schedule_server_version_seq'::regclass);
    NEW.created_at := pg_catalog.clock_timestamp();
  ELSE
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'student schedule identity is immutable' USING ERRCODE = '22023';
    END IF;
    NEW.revision := OLD.revision + 1;
    NEW.server_version := nextval('public.student_schedule_server_version_seq'::regclass);
    NEW.created_at := OLD.created_at;
  END IF;

  NEW.updated_at := pg_catalog.clock_timestamp();
  IF NEW.deleted_at IS NOT NULL THEN
    NEW.payload := NULL;
  END IF;

  IF NEW.deleted_at IS NULL
    AND (TG_OP = 'INSERT' OR OLD.deleted_at IS NOT NULL)
  THEN
    SELECT count(*)
    INTO v_active_count
    FROM public.student_schedule_courses AS schedules
    WHERE schedules.user_id = NEW.user_id
      AND schedules.deleted_at IS NULL
      AND schedules.id <> NEW.id;

    IF v_active_count >= 200 THEN
      RAISE EXCEPTION 'active student schedule quota exceeded'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_student_schedule_row_trigger
BEFORE INSERT OR UPDATE ON public.student_schedule_courses
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_schedule_row();

CREATE FUNCTION public.student_schedule_authenticated_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid()
$$;

REVOKE ALL ON FUNCTION public.student_schedule_authenticated_user_id()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_schedule_authenticated_user_id()
  TO student_schedule_mutator;

ALTER TABLE public.student_schedule_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_schedule_courses FORCE ROW LEVEL SECURITY;

CREATE POLICY student_schedule_courses_select_own
ON public.student_schedule_courses
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY student_schedule_courses_mutator_select
ON public.student_schedule_courses
FOR SELECT
TO student_schedule_mutator
USING ((SELECT public.student_schedule_authenticated_user_id()) = user_id);

CREATE POLICY student_schedule_courses_mutator_insert
ON public.student_schedule_courses
FOR INSERT
TO student_schedule_mutator
WITH CHECK ((SELECT public.student_schedule_authenticated_user_id()) = user_id);

CREATE POLICY student_schedule_courses_mutator_update
ON public.student_schedule_courses
FOR UPDATE
TO student_schedule_mutator
USING ((SELECT public.student_schedule_authenticated_user_id()) = user_id)
WITH CHECK ((SELECT public.student_schedule_authenticated_user_id()) = user_id);

CREATE POLICY student_schedule_courses_mutator_delete
ON public.student_schedule_courses
FOR DELETE
TO student_schedule_mutator
USING ((SELECT public.student_schedule_authenticated_user_id()) = user_id);

REVOKE ALL ON TABLE public.student_schedule_courses
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.student_schedule_courses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_schedule_courses
  TO student_schedule_mutator;

REVOKE ALL ON SEQUENCE public.student_schedule_server_version_seq
  FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.student_schedule_server_version_seq
  TO student_schedule_mutator;
GRANT USAGE ON SCHEMA public TO student_schedule_mutator;

CREATE FUNCTION public.apply_student_schedule_mutation(
  p_mutation_id UUID,
  p_course_id UUID,
  p_expected_revision BIGINT,
  p_operation TEXT,
  p_payload JSONB DEFAULT NULL
)
RETURNS TABLE (
  status TEXT,
  id UUID,
  payload JSONB,
  revision BIGINT,
  server_version BIGINT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_existing public.student_schedule_courses%ROWTYPE;
  v_result public.student_schedule_courses%ROWTYPE;
  v_active_count INTEGER;
BEGIN
  v_user_id := public.student_schedule_authenticated_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_mutation_id IS NULL
    OR p_course_id IS NULL
    OR p_expected_revision IS NULL
    OR p_expected_revision < 0
    OR p_operation IS NULL
    OR p_operation NOT IN ('upsert', 'delete')
  THEN
    RAISE EXCEPTION 'invalid mutation parameters' USING ERRCODE = '22023';
  END IF;

  IF p_operation = 'upsert'
    AND (
      p_payload IS NULL
      OR pg_catalog.jsonb_typeof(p_payload) <> 'object'
      OR p_payload ->> 'id' IS DISTINCT FROM p_course_id::text
      OR pg_catalog.octet_length(p_payload::text) > 32768
    )
  THEN
    RAISE EXCEPTION 'invalid student schedule payload' USING ERRCODE = '22023';
  END IF;

  IF p_operation = 'delete' AND p_payload IS NOT NULL THEN
    RAISE EXCEPTION 'delete payload must be null' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  SELECT schedules.*
  INTO v_existing
  FROM public.student_schedule_courses AS schedules
  WHERE schedules.user_id = v_user_id
    AND schedules.id = p_course_id
  FOR UPDATE;

  IF FOUND AND v_existing.last_mutation_id = p_mutation_id THEN
    RETURN QUERY SELECT
      'replayed'::TEXT,
      v_existing.id,
      v_existing.payload,
      v_existing.revision,
      v_existing.server_version,
      v_existing.created_at,
      v_existing.updated_at,
      v_existing.deleted_at;
    RETURN;
  END IF;

  IF (NOT FOUND AND p_expected_revision <> 0)
    OR (FOUND AND v_existing.revision <> p_expected_revision)
  THEN
    RETURN QUERY SELECT
      'conflict'::TEXT,
      COALESCE(v_existing.id, p_course_id),
      v_existing.payload,
      v_existing.revision,
      v_existing.server_version,
      v_existing.created_at,
      v_existing.updated_at,
      v_existing.deleted_at;
    RETURN;
  END IF;

  IF p_operation = 'upsert' THEN
    IF NOT FOUND OR v_existing.deleted_at IS NOT NULL THEN
      SELECT count(*)
      INTO v_active_count
      FROM public.student_schedule_courses AS schedules
      WHERE schedules.user_id = v_user_id
        AND schedules.deleted_at IS NULL;

      IF v_active_count >= 200 THEN
        RAISE EXCEPTION 'active student schedule quota exceeded'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;

    INSERT INTO public.student_schedule_courses (
      user_id,
      id,
      payload,
      last_mutation_id,
      deleted_at
    )
    VALUES (
      v_user_id,
      p_course_id,
      p_payload,
      p_mutation_id,
      NULL
    )
    ON CONFLICT ON CONSTRAINT student_schedule_courses_pkey DO UPDATE
    SET payload = EXCLUDED.payload,
        last_mutation_id = EXCLUDED.last_mutation_id,
        deleted_at = NULL
    RETURNING * INTO v_result;
  ELSE
    IF NOT FOUND THEN
      INSERT INTO public.student_schedule_courses (
        user_id,
        id,
        payload,
        last_mutation_id,
        deleted_at
      )
      VALUES (
        v_user_id,
        p_course_id,
        NULL,
        p_mutation_id,
        pg_catalog.clock_timestamp()
      )
      RETURNING * INTO v_result;
    ELSE
      UPDATE public.student_schedule_courses AS schedules
      SET payload = NULL,
          last_mutation_id = p_mutation_id,
          deleted_at = pg_catalog.clock_timestamp()
      WHERE schedules.user_id = v_user_id
        AND schedules.id = p_course_id
      RETURNING * INTO v_result;
    END IF;
  END IF;

  RETURN QUERY SELECT
    CASE WHEN p_operation = 'delete' THEN 'deleted' ELSE 'upserted' END,
    v_result.id,
    v_result.payload,
    v_result.revision,
    v_result.server_version,
    v_result.created_at,
    v_result.updated_at,
    v_result.deleted_at;
END;
$$;

GRANT CREATE ON SCHEMA public TO student_schedule_mutator;
REVOKE ALL ON FUNCTION public.apply_student_schedule_mutation(UUID, UUID, BIGINT, TEXT, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_student_schedule_mutation(UUID, UUID, BIGINT, TEXT, JSONB)
  TO authenticated;
ALTER FUNCTION public.apply_student_schedule_mutation(UUID, UUID, BIGINT, TEXT, JSONB)
  OWNER TO student_schedule_mutator;
REVOKE CREATE ON SCHEMA public FROM student_schedule_mutator;
REVOKE student_schedule_mutator FROM postgres;

REVOKE ALL ON FUNCTION public.enforce_student_schedule_row()
  FROM PUBLIC, anon, authenticated;
