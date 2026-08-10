import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getMapGraphSnapshot,
  resolveMapGraphSnapshotResult,
  saveMapGraph,
} from "./navigation.ts";
import type { MapEdge, MapNode } from "@/lib/types/graph";

const node = (id: string): MapNode => ({
  id,
  lat: 10.744,
  lng: 124.794,
  type: "node",
});

const edge = (id: string, source_id: string, target_id: string, bidirectional = false): MapEdge => ({
  id,
  source_id,
  target_id,
  weight: 10,
  bidirectional,
  type: "walkway",
  access: ["walking"],
});

test("saveMapGraph uses one revisioned RPC and never issues generic table writes", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: 8, error: null };
    },
  };

  const nodes = [node("00000000-0000-4000-8000-000000000001")];
  const edges: MapEdge[] = [];
  const result = await saveMapGraph(nodes, edges, 7, client as never);

  assert.equal(result.error, null);
  assert.equal(result.revision, 8);
  assert.deepEqual(calls, [
    {
      name: "replace_map_graph",
      args: {
        p_expected_revision: 7,
        p_nodes: nodes,
        p_edges: edges,
      },
    },
  ]);
});

test("getMapGraphSnapshot uses one coherent aggregate RPC", async () => {
  const calls: string[] = [];
  const client = {
    rpc: async (name: string) => {
      calls.push(name);
      return {
        data: [{ revision: "12", nodes: [node("a")], edges: [] }],
        error: null,
      };
    },
  };

  const result = await getMapGraphSnapshot(client as never);

  assert.equal(result.error, null);
  assert.equal(result.data?.revision, 12);
  assert.deepEqual(calls, ["read_map_graph"]);
});

test("snapshot parsing rejects malformed or dangling graph data before hydration", () => {
  assert.throws(
    () => resolveMapGraphSnapshotResult({ data: [{ revision: 1, nodes: [], edges: [{ id: "e" }] }], error: null }),
    /Invalid navigation graph snapshot/,
  );
  assert.throws(
    () => resolveMapGraphSnapshotResult({ data: [{ revision: "not-a-revision", nodes: [], edges: [] }], error: null }),
    /Invalid navigation graph snapshot/,
  );
});

test("replace_map_graph migration is locked down and validates the full graph", async () => {
  const migration = await readFile(
    new URL("../../../supabase/migrations/20260810015517_replace_map_graph.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.map_graph_state/i);
  assert.match(migration, /id\s+boolean\s+PRIMARY KEY/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.replace_map_graph\(\s*p_expected_revision\s+BIGINT\s*,\s*p_nodes\s+JSONB\s*,\s*p_edges\s+JSONB/i);
  assert.match(migration, /SECURITY DEFINER[\s\S]+SET search_path\s*=\s*''/i);
  assert.match(migration, /public\.has_app_role\('admin'\)/i);
  assert.match(migration, /FOR UPDATE/i);
  assert.match(migration, /jsonb_array_length\(p_nodes\)/i);
  assert.match(migration, /jsonb_array_length\(p_edges\)/i);
  assert.match(migration, /UPDATE pg_temp\.map_graph_nodes_input[\s\S]+building_ids = coalesce\(building_ids, ARRAY\[\]::UUID\[\]\)[\s\S]+created_at = coalesce\(created_at, now\(\)\)[\s\S]+is_closed = coalesce\(is_closed, FALSE\)[\s\S]+closure_daily_schedule = coalesce\(closure_daily_schedule, '\{\}'::JSONB\)/i);
  assert.match(migration, /UPDATE pg_temp\.map_graph_edges_input[\s\S]+bidirectional = coalesce\(bidirectional, TRUE\)[\s\S]+type = coalesce\(type, 'walkway'\)[\s\S]+access = coalesce\(access, ARRAY\['walking'\]::TEXT\[\]\)[\s\S]+closure_daily_schedule = coalesce\(closure_daily_schedule, '\{\}'::JSONB\)/i);
  assert.match(migration, /source_id|target_id/i);
  assert.match(migration, /bidirectional/i);
  assert.match(migration, /GROUP BY edge_row\.id, access_mode[\s\S]+HAVING count\(\*\) > 1/i);
  assert.match(migration, /DELETE FROM public\.map_edges[\s\S]+DELETE FROM public\.map_nodes[\s\S]+INSERT INTO public\.map_nodes[\s\S]+INSERT INTO public\.map_edges/i);
  assert.match(migration, /next_revision\s*:=\s*current_revision\s*\+\s*1/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.replace_map_graph[\s\S]+FROM PUBLIC, anon, authenticated/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.replace_map_graph[\s\S]+TO authenticated/i);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.map_nodes, public\.map_edges[\s\S]+FROM PUBLIC, anon, authenticated/i);
  for (const policy of [
    "Authenticated users can insert nodes",
    "Authenticated users can update nodes",
    "Authenticated users can delete nodes",
    "Admins can insert nodes",
    "Admins can update nodes",
    "Admins can delete nodes",
    "Authenticated users can insert edges",
    "Authenticated users can update edges",
    "Authenticated users can delete edges",
    "Admins can insert edges",
    "Admins can update edges",
    "Admins can delete edges",
  ]) {
    assert.match(migration, new RegExp(`DROP POLICY IF EXISTS "${policy}"`, "i"));
  }
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.read_map_graph\(\)/i);
  assert.match(migration, /RETURNS TABLE[\s\S]+revision BIGINT[\s\S]+nodes JSONB[\s\S]+edges JSONB/i);
  assert.match(migration, /read_map_graph[\s\S]+SECURITY DEFINER[\s\S]+SET search_path\s*=\s*''/i);
  const readFunctionStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.read_map_graph()");
  const readFunctionEnd = migration.indexOf("REVOKE ALL ON FUNCTION public.read_map_graph()", readFunctionStart);
  assert.ok(readFunctionStart >= 0 && readFunctionEnd > readFunctionStart);
  const readFunction = migration.slice(readFunctionStart, readFunctionEnd);
  assert.doesNotMatch(readFunction, /has_app_role\('admin'\)/i);
  assert.match(readFunction, /jsonb_agg\(to_jsonb/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.read_map_graph\(\)[\s\S]+FROM PUBLIC, anon, authenticated/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.read_map_graph\(\)[\s\S]+TO authenticated/i);
  assert.match(migration, /ALTER TABLE public\.map_graph_state ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /FOR SELECT TO authenticated[\s\S]+has_app_role\('admin'\)/i);
  assert.match(migration, /write RPC below remains strictly app-role-bound/i);
});

test("editor cache writes follow a successful RPC and failed drafts are never filtered into cache", async () => {
  const editor = await readFile(
    new URL("../../../components/admin/navigation/navigation-editor.tsx", import.meta.url),
    "utf8",
  );
  const saveIndex = editor.indexOf("const result = await saveMapGraph");
  const cacheIndex = editor.indexOf("await db.map_nodes.clear()", saveIndex);

  assert.ok(saveIndex >= 0);
  assert.ok(cacheIndex > saveIndex);
  assert.doesNotMatch(editor, /validEdges/);
  assert.doesNotMatch(editor, /getMapNodes|getMapEdges|getMapGraphRevision|resolveMapGraphResults/);
  assert.ok((editor.match(/getMapGraphSnapshot\(\)/g) ?? []).length >= 4);
  assert.match(editor, /operationRef\.current !== ["']idle["']/);
  assert.match(editor, /Your draft is preserved; choose how to resolve it below/i);
  assert.match(editor, /save over revision/i);
  assert.match(editor, /Discard draft &[\s\S]*use server/i);
  assert.match(editor, /Keep my draft/i);
  assert.match(editor, /isAutosave && manualOverwriteRef\.current/i);
  assert.match(editor, /manualOverwriteRef\.current = true/i);
  assert.match(editor, /if \(!isAutosave\) manualOverwriteRef\.current = false/i);
  assert.match(editor, /if \(graphConflict\)/i);
  assert.match(editor, /if \(manualOverwriteRef\.current\)/i);
  assert.match(editor, /setGraphConflict\(resolveNavigationConflictSnapshot\(\{ data: null, error: snapshotError \}\)\)/i);
});

test("database CI runs the navigation integration matrix after local bootstrap", async () => {
  const workflow = await readFile(
    new URL("../../../.github/workflows/quality.yml", import.meta.url),
    "utf8",
  );

  assert.match(
    workflow,
    /NAVIGATION_DB_INTEGRATION=1 node --experimental-test-module-mocks --import tsx --test lib\/supabase\/queries\/navigation-db\.integration\.test\.ts/,
  );
});
