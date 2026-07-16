CREATE INDEX IF NOT EXISTS idx_ai_knowledge_entries_weighted_search
  ON ai_knowledge_entries USING GIN (
    (
      setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english'::regconfig, coalesce(content, '')), 'B') ||
      setweight(to_tsvector('english'::regconfig, coalesce(source, '')), 'D')
    )
  );

CREATE OR REPLACE FUNCTION search_ai_knowledge_entries(
  search_query text,
  match_limit int DEFAULT 8,
  fetch_limit int DEFAULT 100
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
AS $$
  WITH query AS (
    SELECT
      websearch_to_tsquery('english'::regconfig, coalesce(nullif(search_query, ''), ' ')) AS value,
      coalesce(length(btrim(search_query)), 0) = 0 AS is_blank
  ),
  searchable AS (
    SELECT
      entry.*,
      (
        setweight(to_tsvector('english'::regconfig, coalesce(entry.title, '')), 'A') ||
        setweight(to_tsvector('english'::regconfig, coalesce(entry.content, '')), 'B') ||
        setweight(to_tsvector('english'::regconfig, coalesce(entry.source, '')), 'D')
      ) AS weighted_search_vector
    FROM ai_knowledge_entries entry
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
      ts_rank_cd(entry.weighted_search_vector, query.value) AS search_rank
    FROM searchable entry, query
    WHERE
      entry.is_active = true
      AND (
        query.is_blank
        OR entry.weighted_search_vector @@ query.value
        OR entry.keywords && regexp_split_to_array(lower(coalesce(search_query, '')), '[^a-z0-9.]+')
      )
    ORDER BY
      CASE WHEN query.is_blank THEN 0 ELSE ts_rank_cd(entry.weighted_search_vector, query.value) END DESC,
      entry.priority DESC,
      entry.updated_at DESC
    LIMIT least(greatest(fetch_limit, match_limit), 200)
  )
  SELECT *
  FROM ranked
  ORDER BY search_rank DESC, priority DESC, updated_at DESC
  LIMIT least(match_limit, 30);
$$;

GRANT EXECUTE ON FUNCTION search_ai_knowledge_entries(text, int, int) TO public;
GRANT EXECUTE ON FUNCTION search_ai_knowledge_entries(text, int, int) TO authenticated;
