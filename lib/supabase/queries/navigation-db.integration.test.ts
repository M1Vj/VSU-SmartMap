import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getMapGraphSnapshot, saveMapGraph } from "./navigation.ts";
import type { MapEdge, MapNode } from "@/lib/types/graph";

const ENABLED = process.env.NAVIGATION_DB_INTEGRATION === "1";
const LOCAL_PASSWORD = "LocalSmartMap123!";

type LocalEnvironment = {
  url: string;
  anonKey: string;
};

function parseStatusEnv(output: string): Record<string, string> {
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .flatMap((line) => {
        const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
        return match ? [[match[1], match[2].replace(/^("|')(.*)\1$/, "$2")]] : [];
      }),
  );
}

function localEnvironment(): LocalEnvironment {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  }

  const output = execFileSync("npx", ["--yes", "supabase@2.107.0", "status", "-o", "env"], {
    encoding: "utf8",
    timeout: 15_000,
  });
  const env = parseStatusEnv(output);
  if (!env.API_URL || !env.ANON_KEY) throw new Error("Local Supabase status is missing API credentials");
  return { url: env.API_URL, anonKey: env.ANON_KEY };
}

async function signedInClient(url: string, anonKey: string, email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: LOCAL_PASSWORD });
  if (error) throw new Error(`Unable to sign in ${email}: ${error.message}`);
  return client;
}

function cloneGraph<T>(value: T): T {
  return structuredClone(value);
}

function newEdge(source_id: string, target_id: string, id: string): MapEdge {
  return {
    id,
    source_id,
    target_id,
    weight: 1,
    bidirectional: false,
    type: "walkway",
    access: ["walking"],
  };
}

test(
  "local navigation RPC integration protects writes, snapshots, races, and rollback",
  { skip: !ENABLED },
  async () => {
    const { url, anonKey } = localEnvironment();
    const admin = await signedInClient(url, anonKey, "admin@smartmap.example");
    const secondAdmin = await signedInClient(url, anonKey, "admin@smartmap.example");
    const student = await signedInClient(url, anonKey, "student@smartmap.example");

    const initial = await getMapGraphSnapshot(admin as never);
    assert.equal(initial.error, null);
    assert.ok(initial.data);
    assert.ok(initial.data.nodes.length > 1, "bootstrap must contain at least two navigation nodes");

    const { data: nonAdminRead, error: nonAdminReadError } = await student.rpc("read_map_graph");
    assert.equal(nonAdminReadError, null);
    assert.deepEqual(nonAdminRead, []);

    const probeNode: MapNode = {
      id: "00000000-0000-4000-8000-000000000099",
      lat: 10.744,
      lng: 124.794,
      type: "node",
    };
    const { error: directNodeWriteError } = await admin.from("map_nodes").insert(probeNode);
    assert.ok(directNodeWriteError, "admin direct node writes must be denied");
    const { error: directEdgeWriteError } = await admin.from("map_edges").insert(
      newEdge(
        initial.data.nodes[0].id,
        initial.data.nodes[1].id,
        "00000000-0000-4000-8000-000000000098",
      ),
    );
    assert.ok(directEdgeWriteError, "admin direct edge writes must be denied");

    const baselineNodes = cloneGraph(initial.data.nodes);
    const baselineEdges = cloneGraph(initial.data.edges);
    let revision = initial.data.revision;

    const firstCommit = await saveMapGraph(baselineNodes, baselineEdges, revision, admin as never);
    assert.equal(firstCommit.error, null);
    assert.equal(firstCommit.revision, revision + 1);
    revision += 1;

    const [raceA, raceB] = await Promise.all([
      saveMapGraph(baselineNodes, baselineEdges, revision, admin as never),
      saveMapGraph(baselineNodes, baselineEdges, revision, secondAdmin as never),
    ]);
    assert.equal([raceA, raceB].filter((result) => result.error === null).length, 1);
    assert.equal([raceA, raceB].filter((result) => (result.error as { code?: string } | null)?.code === "P0002").length, 1);
    revision += 1;

    const expectRejectedWithoutMutation = async (nodes: MapNode[], edges: MapEdge[]) => {
      const result = await saveMapGraph(nodes, edges, revision, admin as never);
      assert.ok(result.error);
      assert.equal(result.revision, null);
      const after = await getMapGraphSnapshot(admin as never);
      assert.equal(after.error, null);
      assert.ok(after.data);
      assert.equal(after.data.revision, revision);
      assert.deepEqual(after.data.nodes, baselineNodes);
      assert.deepEqual(after.data.edges, baselineEdges);
    };

    const firstNode = baselineNodes[0];
    const secondNode = baselineNodes[1] ?? baselineNodes[0];
    const firstEdge = baselineEdges[0] ?? newEdge(firstNode.id, secondNode.id, "00000000-0000-4000-8000-000000000097");

    await expectRejectedWithoutMutation(
      [{ ...baselineNodes[0], id: "not-a-uuid" }, ...baselineNodes.slice(1)],
      baselineEdges,
    );
    await expectRejectedWithoutMutation(
      [{ ...baselineNodes[0], lat: null as unknown as number }, ...baselineNodes.slice(1)],
      baselineEdges,
    );
    await expectRejectedWithoutMutation(
      baselineNodes,
      [...baselineEdges, newEdge(firstNode.id, "00000000-0000-4000-8000-000000000096", "00000000-0000-4000-8000-000000000095")],
    );
    await expectRejectedWithoutMutation(
      baselineNodes,
      baselineEdges.map((edge, index) => index === 0 ? { ...edge, type: "invalid" as MapEdge["type"] } : edge),
    );
    await expectRejectedWithoutMutation(
      baselineNodes,
      baselineEdges.map((edge, index) => index === 0 ? { ...edge, access: ["hoverboard"] as never } : edge),
    );
    await expectRejectedWithoutMutation(
      baselineNodes,
      baselineEdges.map((edge, index) => index === 0 ? { ...edge, access: ["walking", "walking"] } : edge),
    );
    await expectRejectedWithoutMutation(
      baselineNodes,
      [...baselineEdges, { ...firstEdge, id: "00000000-0000-4000-8000-000000000094" }],
    );

    const final = await getMapGraphSnapshot(admin as never);
    assert.equal(final.error, null);
    assert.equal(final.data?.revision, revision);
  },
);
