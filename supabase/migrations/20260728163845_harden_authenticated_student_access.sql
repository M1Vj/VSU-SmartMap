-- Google OAuth turns ordinary students into `authenticated` callers. Remove
-- permissive hosted drift without changing the public catalog read surface.
DROP POLICY IF EXISTS "Authenticated users can insert facilities" ON public.facilities;
DROP POLICY IF EXISTS "Authenticated users can update facilities" ON public.facilities;
DROP POLICY IF EXISTS "Authenticated users can delete facilities" ON public.facilities;
DROP POLICY IF EXISTS "Authenticated users can manage facilities" ON public.facilities;

DROP POLICY IF EXISTS "Authenticated users can insert rooms" ON public.rooms;
DROP POLICY IF EXISTS "Authenticated users can update rooms" ON public.rooms;
DROP POLICY IF EXISTS "Authenticated users can delete rooms" ON public.rooms;
DROP POLICY IF EXISTS "Authenticated users can manage rooms" ON public.rooms;

DROP POLICY IF EXISTS "Authenticated users can read suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Authenticated users can view suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Authenticated users can update suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Authenticated users can insert suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Authenticated users can delete suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Authenticated users can manage suggestions" ON public.suggestions;

-- Keep the legacy bucket readable, but make repeated forward application close
-- any write policies reintroduced by hosted drift.
DROP POLICY IF EXISTS "Authenticated upload event-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update event-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete event-images" ON storage.objects;

-- Trigger and cleanup routines are not API endpoints. Trigger execution does
-- not require callers to hold EXECUTE, and the postgres owner retains access.
REVOKE EXECUTE ON FUNCTION public.delete_expired_verification_documents() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_owner_listing_transition() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.propagate_owner_display_name() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_boarding_house_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_boarding_house_owner_display_name() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_app_role(public.app_user_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_expired_verification_documents() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_app_role(public.app_user_role) TO authenticated;

-- Empty paths are safe because relations and non-catalog schemas referenced by
-- these bodies are explicitly qualified. pg_catalog remains implicitly visible.
ALTER FUNCTION public.delete_expired_verification_documents() SET search_path = '';
ALTER FUNCTION public.enforce_owner_listing_transition() SET search_path = '';
ALTER FUNCTION public.has_app_role(public.app_user_role) SET search_path = '';
ALTER FUNCTION public.propagate_owner_display_name() SET search_path = '';
ALTER FUNCTION public.recompute_boarding_house_rating() SET search_path = '';
ALTER FUNCTION public.set_boarding_house_owner_display_name() SET search_path = '';

-- Preserve output and ranking while removing the mutable path reported by the
-- hosted catalog. This remains an intentionally public, read-only search RPC.
CREATE OR REPLACE FUNCTION public.search_ai_knowledge_entries(
  search_query text,
  match_limit integer DEFAULT 8,
  fetch_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  keywords text[],
  source text,
  is_active boolean,
  priority integer,
  created_at timestamptz,
  updated_at timestamptz,
  search_rank real
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH query AS (
    SELECT
      pg_catalog.websearch_to_tsquery(
        'english'::pg_catalog.regconfig,
        coalesce(nullif(search_query, ''), ' ')
      ) AS value,
      coalesce(pg_catalog.length(pg_catalog.btrim(search_query)), 0) = 0 AS is_blank
  ),
  searchable AS (
    SELECT
      entry.*,
      (
        pg_catalog.setweight(
          pg_catalog.to_tsvector('english'::pg_catalog.regconfig, coalesce(entry.title, '')),
          'A'
        ) ||
        pg_catalog.setweight(
          pg_catalog.to_tsvector('english'::pg_catalog.regconfig, coalesce(entry.content, '')),
          'B'
        ) ||
        pg_catalog.setweight(
          pg_catalog.to_tsvector('english'::pg_catalog.regconfig, coalesce(entry.source, '')),
          'D'
        )
      ) AS weighted_search_vector
    FROM public.ai_knowledge_entries AS entry
  ),
  ranked AS (
    SELECT
      entry.id,
      entry.title,
      entry.content,
      entry.keywords,
      entry.source,
      entry.is_active,
      entry.priority,
      entry.created_at,
      entry.updated_at,
      pg_catalog.ts_rank_cd(entry.weighted_search_vector, query.value) AS search_rank
    FROM searchable AS entry, query
    WHERE
      entry.is_active = true
      AND (
        query.is_blank
        OR entry.weighted_search_vector @@ query.value
        OR entry.keywords && pg_catalog.regexp_split_to_array(
          pg_catalog.lower(coalesce(search_query, '')),
          '[^a-z0-9.]+'
        )
      )
    ORDER BY
      CASE
        WHEN query.is_blank THEN 0
        ELSE pg_catalog.ts_rank_cd(entry.weighted_search_vector, query.value)
      END DESC,
      entry.priority DESC,
      entry.updated_at DESC
    LIMIT least(greatest(fetch_limit, match_limit), 200)
  )
  SELECT *
  FROM ranked
  ORDER BY search_rank DESC, priority DESC, updated_at DESC
  LIMIT least(match_limit, 30);
$$;

REVOKE EXECUTE ON FUNCTION public.search_ai_knowledge_entries(text, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_ai_knowledge_entries(text, integer, integer)
  TO PUBLIC, authenticated;

-- New postgres-owned functions are private by default. Service code may use
-- future routines, while migrations must still explicitly grant browser roles.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;
