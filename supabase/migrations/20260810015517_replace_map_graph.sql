-- The navigation editor submits the graph as one optimistic-concurrency
-- transaction. The state row is deliberately private: it is only readable by
-- admins and cannot be written through the Data API.
CREATE TABLE IF NOT EXISTS public.map_graph_state (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.map_graph_state (id, revision)
VALUES (TRUE, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.map_graph_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read map graph state" ON public.map_graph_state;
CREATE POLICY "Admins can read map graph state"
  ON public.map_graph_state
  FOR SELECT TO authenticated
  USING (public.has_app_role('admin'));

REVOKE ALL ON TABLE public.map_graph_state FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.map_graph_state TO authenticated;

-- The graph replacement RPC is the sole authenticated write path. The
-- original navigation migration and the later admin hardening migration both
-- created direct mutation policies; remove every known policy name so this is
-- safe to apply repeatedly while preserving public/authenticated reads and
-- service-role access.
DROP POLICY IF EXISTS "Authenticated users can insert nodes" ON public.map_nodes;
DROP POLICY IF EXISTS "Authenticated users can update nodes" ON public.map_nodes;
DROP POLICY IF EXISTS "Authenticated users can delete nodes" ON public.map_nodes;
DROP POLICY IF EXISTS "Admins can insert nodes" ON public.map_nodes;
DROP POLICY IF EXISTS "Admins can update nodes" ON public.map_nodes;
DROP POLICY IF EXISTS "Admins can delete nodes" ON public.map_nodes;
DROP POLICY IF EXISTS "Authenticated users can insert edges" ON public.map_edges;
DROP POLICY IF EXISTS "Authenticated users can update edges" ON public.map_edges;
DROP POLICY IF EXISTS "Authenticated users can delete edges" ON public.map_edges;
DROP POLICY IF EXISTS "Admins can insert edges" ON public.map_edges;
DROP POLICY IF EXISTS "Admins can update edges" ON public.map_edges;
DROP POLICY IF EXISTS "Admins can delete edges" ON public.map_edges;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.map_nodes, public.map_edges
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.replace_map_graph(
  p_expected_revision BIGINT,
  p_nodes JSONB,
  p_edges JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_revision BIGINT;
  next_revision BIGINT;
BEGIN
  -- SECURITY DEFINER must never turn an authenticated session into a generic
  -- graph writer. The role check stays explicit even if table grants change.
  IF public.has_app_role('admin') IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_expected_revision IS NULL OR p_expected_revision < 0
     OR p_nodes IS NULL OR jsonb_typeof(p_nodes) <> 'array'
     OR p_edges IS NULL OR jsonb_typeof(p_edges) <> 'array' THEN
    RAISE EXCEPTION 'invalid graph payload' USING ERRCODE = 'P0001';
  END IF;

  -- These caps are intentionally below the Data API request/body limits and
  -- keep validation and replacement bounded for an admin-triggered request.
  IF jsonb_array_length(p_nodes) > 10000
     OR jsonb_array_length(p_edges) > 30000 THEN
    RAISE EXCEPTION 'graph payload exceeds size limits' USING ERRCODE = 'P0001';
  END IF;

  -- Serialize all writers on the one graph-state row before checking the
  -- caller's revision. A stale caller therefore cannot delete a newer graph.
  SELECT revision
    INTO current_revision
    FROM public.map_graph_state
   WHERE id = TRUE
   FOR UPDATE;

  IF current_revision IS NULL THEN
    RAISE EXCEPTION 'graph state is unavailable' USING ERRCODE = 'P0001';
  END IF;

  IF p_expected_revision <> current_revision THEN
    RAISE EXCEPTION 'stale graph revision' USING ERRCODE = 'P0002';
  END IF;

  -- Parse each JSON array once into indexed temporary relations. This keeps
  -- duplicate/end-point/directional checks set-based instead of quadratic
  -- array scans at the payload caps.
  DROP TABLE IF EXISTS pg_temp.map_graph_nodes_input;
  DROP TABLE IF EXISTS pg_temp.map_graph_edges_input;
  CREATE TEMP TABLE map_graph_nodes_input (LIKE public.map_nodes INCLUDING DEFAULTS)
    ON COMMIT DROP;
  CREATE TEMP TABLE map_graph_edges_input (LIKE public.map_edges INCLUDING DEFAULTS)
    ON COMMIT DROP;
  ALTER TABLE pg_temp.map_graph_nodes_input ADD PRIMARY KEY (id);
  ALTER TABLE pg_temp.map_graph_edges_input ADD PRIMARY KEY (id);

  -- jsonb_populate_recordset performs typed UUID/number/boolean conversion.
  -- All checks happen before either graph table is touched, so malformed input
  -- leaves the previous graph and revision intact when the transaction rolls
  -- back.
  INSERT INTO pg_temp.map_graph_nodes_input
    SELECT * FROM jsonb_populate_recordset(NULL::public.map_nodes, p_nodes);
  INSERT INTO pg_temp.map_graph_edges_input
    SELECT * FROM jsonb_populate_recordset(NULL::public.map_edges, p_edges);

  IF EXISTS (
       SELECT 1
         FROM pg_temp.map_graph_nodes_input
        WHERE id IS NULL
           OR lat IS NULL OR lat::TEXT IN ('NaN', 'Infinity', '-Infinity') OR lat < -90 OR lat > 90
           OR lng IS NULL OR lng::TEXT IN ('NaN', 'Infinity', '-Infinity') OR lng < -180 OR lng > 180
           OR type IS NULL
           OR type NOT IN ('node', 'building_entry', 'gate', 'path_start', 'path_middle', 'path_end')
     ) THEN
    RAISE EXCEPTION 'invalid graph node' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
       SELECT 1
         FROM pg_temp.map_graph_nodes_input
        WHERE (label IS NOT NULL AND char_length(label) > 500)
           OR (group_id IS NOT NULL AND char_length(group_id) > 200)
           OR (floor_level IS NOT NULL AND (floor_level < -100 OR floor_level > 100))
           OR coalesce(array_length(building_ids, 1), 0) > 100
           OR array_position(building_ids, NULL::UUID) IS NOT NULL
           OR coalesce(array_length(closure_recurring_days, 1), 0) > 7
           OR EXISTS (
                SELECT 1
                  FROM unnest(coalesce(closure_recurring_days, ARRAY[]::INTEGER[])) AS day_number
                 WHERE day_number IS NULL OR day_number < 0 OR day_number > 6
           )
           OR (closure_daily_schedule IS NOT NULL AND jsonb_typeof(closure_daily_schedule) <> 'object')
     ) THEN
    RAISE EXCEPTION 'invalid graph node metadata' USING ERRCODE = 'P0001';
  END IF;

  UPDATE pg_temp.map_graph_edges_input
     SET type = coalesce(type, 'walkway'),
         access = coalesce(access, ARRAY['walking']::TEXT[]),
         bidirectional = coalesce(bidirectional, TRUE)
   WHERE TRUE;

  IF EXISTS (
       SELECT 1
         FROM pg_temp.map_graph_edges_input AS edge_row
        WHERE edge_row.id IS NULL
           OR edge_row.source_id IS NULL
           OR edge_row.target_id IS NULL
           OR edge_row.source_id = edge_row.target_id
           OR NOT EXISTS (SELECT 1 FROM pg_temp.map_graph_nodes_input AS node_row WHERE node_row.id = edge_row.source_id)
           OR NOT EXISTS (SELECT 1 FROM pg_temp.map_graph_nodes_input AS node_row WHERE node_row.id = edge_row.target_id)
           OR edge_row.weight IS NULL
           OR edge_row.weight::TEXT IN ('NaN', 'Infinity', '-Infinity')
           OR edge_row.weight < 0 OR edge_row.weight > 1000000000
           OR edge_row.type NOT IN ('walkway', 'road')
           OR coalesce(array_length(edge_row.access, 1), 0) = 0
           OR coalesce(array_length(edge_row.access, 1), 0) > 3
           OR EXISTS (
                SELECT 1
                  FROM unnest(edge_row.access) AS access_mode
                 WHERE access_mode IS NULL OR access_mode NOT IN ('walking', 'driving', 'cycling')
           )
           OR coalesce(array_length(edge_row.closure_recurring_days, 1), 0) > 7
           OR EXISTS (
                SELECT 1
                  FROM unnest(coalesce(edge_row.closure_recurring_days, ARRAY[]::INTEGER[])) AS day_number
                 WHERE day_number IS NULL OR day_number < 0 OR day_number > 6
           )
           OR (edge_row.closure_daily_schedule IS NOT NULL
               AND jsonb_typeof(edge_row.closure_daily_schedule) <> 'object')
     ) THEN
    RAISE EXCEPTION 'invalid graph edge' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
       SELECT 1
         FROM pg_temp.map_graph_edges_input AS edge_row
         CROSS JOIN LATERAL unnest(edge_row.access) AS access_mode
        GROUP BY edge_row.id, access_mode
       HAVING count(*) > 1
     ) THEN
    RAISE EXCEPTION 'duplicate graph edge access mode' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
       SELECT 1
         FROM pg_temp.map_graph_edges_input
        GROUP BY source_id, target_id
       HAVING count(*) > 1
     ) THEN
    RAISE EXCEPTION 'duplicate graph edge direction' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
       SELECT 1
         FROM pg_temp.map_graph_edges_input
        GROUP BY LEAST(source_id, target_id), GREATEST(source_id, target_id)
       HAVING count(*) > 1 AND bool_or(bidirectional)
     ) THEN
    RAISE EXCEPTION 'two-way graph edge overlaps another direction' USING ERRCODE = 'P0001';
  END IF;

  -- FK-safe replacement. The function is one transaction, so any constraint
  -- or insert failure restores both tables and leaves revision unchanged.
  DELETE FROM public.map_edges;
  DELETE FROM public.map_nodes;

  INSERT INTO public.map_nodes (
    id, lat, lng, label, type, building_ids, floor_level, created_at,
    is_closed, closed_until_toggled, closed_from, closed_until, closure_reason,
    closure_recurring_start, closure_recurring_end, closure_recurring_days,
    closure_daily_schedule, group_id
  )
  SELECT id, lat, lng, label, type, building_ids, floor_level, created_at,
         is_closed, closed_until_toggled, closed_from, closed_until, closure_reason,
         closure_recurring_start, closure_recurring_end, closure_recurring_days,
         closure_daily_schedule, group_id
    FROM pg_temp.map_graph_nodes_input;

  INSERT INTO public.map_edges (
    id, source_id, target_id, weight, bidirectional, created_at, type, access,
    is_closed, closed_until_toggled, closed_from, closed_until, closure_reason,
    closure_recurring_start, closure_recurring_end, closure_recurring_days,
    closure_daily_schedule, group_id
  )
  SELECT id, source_id, target_id, weight, coalesce(bidirectional, TRUE), created_at,
         coalesce(type, 'walkway'), coalesce(access, ARRAY['walking']::TEXT[]),
         is_closed, closed_until_toggled, closed_from, closed_until, closure_reason,
         closure_recurring_start, closure_recurring_end, closure_recurring_days,
         closure_daily_schedule, group_id
    FROM pg_temp.map_graph_edges_input;

  next_revision := current_revision + 1;
  UPDATE public.map_graph_state
     SET revision = next_revision,
         updated_at = now()
   WHERE id = TRUE;

  RETURN next_revision;
END;
$$;

-- One read RPC gives the editor a coherent MVCC snapshot of revision and both
-- graph tables. Returning no row is the authorization boundary for non-admins.
CREATE OR REPLACE FUNCTION public.read_map_graph()
RETURNS TABLE (
  revision BIGINT,
  nodes JSONB,
  edges JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT state.revision,
         COALESCE(
           (SELECT jsonb_agg(to_jsonb(node_row) ORDER BY node_row.id)
              FROM public.map_nodes AS node_row),
           '[]'::JSONB
         ) AS nodes,
         COALESCE(
           (SELECT jsonb_agg(to_jsonb(edge_row) ORDER BY edge_row.id)
              FROM public.map_edges AS edge_row),
           '[]'::JSONB
         ) AS edges
    FROM public.map_graph_state AS state
   WHERE state.id = TRUE
     AND public.has_app_role('admin');
$$;

REVOKE ALL ON FUNCTION public.read_map_graph()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_map_graph()
  TO authenticated;

REVOKE ALL ON FUNCTION public.replace_map_graph(BIGINT, JSONB, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_map_graph(BIGINT, JSONB, JSONB)
  TO authenticated;
