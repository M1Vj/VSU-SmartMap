-- New Supabase projects no longer auto-expose newly created public objects.
-- RLS is the authorization boundary, but PostgREST roles still need explicit
-- object privileges before an RLS policy can be evaluated.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind = 'r'
      AND NOT relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Refusing API grants: every public table must have RLS enabled';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_owner_application(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.moderate_boarding_house_listing(UUID, TEXT, UUID, TEXT) TO service_role;

-- CAPTCHA/rate-limited public writes are server-only. RLS alone cannot prove
-- that a caller passed the application-layer abuse controls.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.boarding_house_reports FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.boarding_house_reviews FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.suggestions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.bug_reports FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.event_suggestions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.submissions FROM anon, authenticated;

-- Future migrations must grant API access only after enabling RLS and defining
-- policies for the new object. Project migrations run as postgres; platform-
-- owned supabase_admin defaults cannot be altered by project migrations.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;
