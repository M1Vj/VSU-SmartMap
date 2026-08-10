import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../browser-client";
import type { MapNode, MapEdge } from "@/lib/types/graph";
import { validateEditorGraph } from "@/lib/pathfinding/editor-graph";

type MaybeClient = SupabaseClient | Promise<SupabaseClient>;

const resolveClient = async (client?: MaybeClient) =>
  Promise.resolve(client ?? getSupabaseBrowserClient());

export type GraphRevisionResult = {
  revision: number | null;
  error: unknown | null;
};

export type MapGraphSnapshot = {
  revision: number;
  nodes: MapNode[];
  edges: MapEdge[];
};

type RpcResult = {
  data: unknown;
  error: unknown | null;
};

const parseRevision = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && "revision" in value) {
    return parseRevision((value as { revision?: unknown }).revision);
  }
  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function isStaleGraphRevisionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === "P0002"
    || (typeof candidate.message === "string" && candidate.message.toLowerCase().includes("stale graph revision"));
}

// Public map rendering still reads the two public graph tables independently;
// the admin editor exclusively uses getMapGraphSnapshot below so its revision
// and graph rows are coherent.
export async function getMapNodes(client?: MaybeClient) {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase.from("map_nodes").select("*");
  return { data: data as MapNode[] | null, error };
}

export async function getMapEdges(client?: MaybeClient) {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase.from("map_edges").select("*");
  return { data: data as MapEdge[] | null, error };
}

/**
 * Parse and validate the single-row snapshot returned by read_map_graph.
 * Validation deliberately runs before the editor or IndexedDB sees any row.
 */
export function resolveMapGraphSnapshotResult(result: RpcResult): MapGraphSnapshot {
  if (result.error) throw result.error;

  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!isRecord(row)) throw new Error("Invalid navigation graph snapshot");

  const revision = parseRevision(row.revision);
  const nodes = row.nodes;
  const edges = row.edges;
  if (revision === null || !Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new Error("Invalid navigation graph snapshot");
  }

  const typedNodes = nodes as MapNode[];
  const typedEdges = edges as MapEdge[];
  const validation = validateEditorGraph(typedNodes, typedEdges);
  if (!validation.ok) throw new Error("Invalid navigation graph snapshot");

  return { revision, nodes: typedNodes, edges: typedEdges };
}

/** Read revision, nodes, and edges from one admin-only database snapshot. */
export async function getMapGraphSnapshot(client?: MaybeClient): Promise<{
  data: MapGraphSnapshot | null;
  error: unknown | null;
}> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase.rpc("read_map_graph");
  if (error) return { data: null, error };

  try {
    return { data: resolveMapGraphSnapshotResult({ data, error: null }), error: null };
  } catch (snapshotError) {
    return { data: null, error: snapshotError };
  }
}

/**
 * Replace the graph through the server-side transaction. No generic table
 * insert/update/delete calls are made here: the RPC validates and commits the
 * whole graph against the caller's optimistic revision in one transaction.
 */
export async function saveMapGraph(
  nodes: MapNode[],
  edges: MapEdge[],
  expectedRevision: number,
  client?: MaybeClient,
): Promise<GraphRevisionResult> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase.rpc("replace_map_graph", {
    p_expected_revision: expectedRevision,
    p_nodes: nodes,
    p_edges: edges,
  });

  if (error) return { revision: null, error };
  const revision = parseRevision(data);
  if (revision === null) {
    return { revision: null, error: new Error("Invalid graph revision response") };
  }
  return { revision, error: null };
}
