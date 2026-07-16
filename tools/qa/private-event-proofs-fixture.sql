\set ON_ERROR_STOP on

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public BOOLEAN NOT NULL DEFAULT false,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[]
);
CREATE TABLE storage.objects (
  id UUID PRIMARY KEY,
  bucket_id TEXT NOT NULL,
  name TEXT NOT NULL
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE TYPE public.event_category AS ENUM (
  'academic', 'sports', 'cultural', 'religious', 'other'
);
CREATE TYPE public.event_suggestion_status AS ENUM (
  'pending', 'approved', 'rejected'
);

CREATE TABLE public.event_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location_text TEXT,
  category public.event_category NOT NULL,
  proof_file_url TEXT NOT NULL,
  status public.event_suggestion_status NOT NULL DEFAULT 'pending',
  submitted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()
);

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
  expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.pending_suggestion_uploads ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_suggestion_uploads TO service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-proofs', 'event-proofs', true);
CREATE POLICY "Public read event-proofs" ON storage.objects
  FOR SELECT TO PUBLIC USING (bucket_id = 'event-proofs');
CREATE POLICY "Authenticated upload event-proofs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-proofs');
CREATE POLICY "Authenticated update event-proofs" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'event-proofs');
CREATE POLICY "Authenticated delete event-proofs" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'event-proofs');

\ir ../../supabase/migrations/20260716001000_private_event_proofs.sql

DO $$
DECLARE
  v_bucket storage.buckets%ROWTYPE;
  v_suggestion public.event_suggestions%ROWTYPE;
BEGIN
  SELECT * INTO v_bucket FROM storage.buckets WHERE id = 'event-proofs';
  IF v_bucket.public OR v_bucket.file_size_limit <> 5242880 THEN
    RAISE EXCEPTION 'event-proofs bucket is not private and bounded';
  END IF;
  IF v_bucket.allowed_mime_types IS DISTINCT FROM ARRAY['image/jpeg', 'image/png', 'image/webp'] THEN
    RAISE EXCEPTION 'event-proofs MIME allowlist is incorrect';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%event-proofs%'
  ) THEN
    RAISE EXCEPTION 'event-proofs still has direct object policies';
  END IF;
  IF has_function_privilege(
    'anon',
    'public.submit_event_suggestion(text,uuid,text,text,timestamptz,timestamptz,text,event_category)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.submit_event_suggestion(text,uuid,text,text,timestamptz,timestamptz,text,event_category)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'API roles can execute the submission RPC';
  END IF;
  IF NOT has_function_privilege(
    'service_role',
    'public.submit_event_suggestion(text,uuid,text,text,timestamptz,timestamptz,text,event_category)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service_role cannot execute the submission RPC';
  END IF;

  INSERT INTO public.pending_suggestion_uploads (
    id, kind, bucket, object_path, owner_hash, bytes, verified_at, expires_at
  ) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'event-proof',
    'event-proofs',
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8/7ba7b810-9dad-11d1-80b4-00c04fd430c9.webp',
    repeat('a', 64),
    1024,
    statement_timestamp(),
    statement_timestamp() + interval '30 minutes'
  );

  SELECT * INTO v_suggestion FROM public.submit_event_suggestion(
    repeat('a', 64),
    '550e8400-e29b-41d4-a716-446655440000',
    'Private evidence fixture',
    NULL,
    statement_timestamp() + interval '1 day',
    statement_timestamp() + interval '2 days',
    'Fixture Hall',
    'academic'
  );
  IF v_suggestion.proof_file_url IS NOT NULL OR
     v_suggestion.proof_object_path <> '6ba7b810-9dad-11d1-80b4-00c04fd430c8/7ba7b810-9dad-11d1-80b4-00c04fd430c9.webp' THEN
    RAISE EXCEPTION 'RPC exposed a URL or lost the private object path';
  END IF;
  IF v_suggestion.decided_at IS NOT NULL OR
     v_suggestion.proof_retain_until IS NOT NULL OR
     v_suggestion.proof_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'new suggestions have premature retention state';
  END IF;
END;
$$;

SELECT 'private event proof fixture passed' AS result;
