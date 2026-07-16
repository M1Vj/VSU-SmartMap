import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { mock } from "node:test";

let cleanupCalls = 0;
let cleanupError: Error | null = null;
let cleanupResult = { scanned: 3, reclaimed: 2, retry: 1 };
let proofCleanupCalls = 0;
let proofCleanupError: Error | null = null;
let proofCleanupResult = { scanned: 4, reclaimed: 3, retry: 1 };

mock.module("@/lib/storage/pending-uploads", {
  namedExports: {
    async reclaimExpiredPendingUploads() {
      cleanupCalls += 1;
      if (cleanupError) throw cleanupError;
      return cleanupResult;
    },
  },
});

mock.module("@/lib/storage/event-proofs", {
  namedExports: {
    async reclaimExpiredEventProofs() {
      proofCleanupCalls += 1;
      if (proofCleanupError) throw proofCleanupError;
      return proofCleanupResult;
    },
  },
});

const routeModule = import("./route.ts");

function request(authorization?: string) {
  return new Request("https://example.test/api/cron/storage-retention", {
    headers: authorization ? { authorization } : undefined,
  });
}

function reset() {
  process.env.CRON_SECRET = "test-cron-secret";
  cleanupCalls = 0;
  cleanupError = null;
  cleanupResult = { scanned: 3, reclaimed: 2, retry: 1 };
  proofCleanupCalls = 0;
  proofCleanupError = null;
  proofCleanupResult = { scanned: 4, reclaimed: 3, retry: 1 };
}

test.beforeEach(reset);

test("fails closed without CRON_SECRET", async () => {
  delete process.env.CRON_SECRET;
  const { GET } = await routeModule;
  const response = await GET(request("Bearer test-cron-secret"));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Storage retention unavailable." });
  assert.equal(cleanupCalls, 0);
});

test("requires the exact bearer authorization value", async () => {
  const { GET } = await routeModule;
  for (const authorization of [undefined, "test-cron-secret", "Bearer wrong", "bearer test-cron-secret", "Bearer  test-cron-secret"]) {
    const response = await GET(request(authorization));
    assert.equal(response.status, 401);
  }
  assert.equal(cleanupCalls, 0);
});

test("runs bounded reclamation for an authorized cron request without caching", async () => {
  const { GET } = await routeModule;
  const response = await GET(request("Bearer test-cron-secret"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    pendingUploads: cleanupResult,
    eventProofs: proofCleanupResult,
  });
  assert.equal(cleanupCalls, 1);
  assert.equal(proofCleanupCalls, 1);
});

test("returns a generic no-cache error when cleanup fails", async () => {
  cleanupError = new Error("database relation and secret detail");
  const { GET } = await routeModule;
  const response = await GET(request("Bearer test-cron-secret"));
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.deepEqual(body, { error: "Unable to reclaim storage." });
  assert.equal(JSON.stringify(body).includes("test-cron-secret"), false);
});

test("keeps cleanup failures generic when event-proof retention cannot run", async () => {
  proofCleanupError = new Error("private object detail");
  const { GET } = await routeModule;
  const response = await GET(request("Bearer test-cron-secret"));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Unable to reclaim storage." });
});

test("documents the secret and schedules one daily Vercel cleanup", async () => {
  const [environment, vercelConfigText] = await Promise.all([
    readFile(new URL("../../../../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../../../../vercel.json", import.meta.url), "utf8"),
  ]);
  assert.match(environment, /^CRON_SECRET=$/m);
  const config = JSON.parse(vercelConfigText) as {
    crons?: Array<{ path: string; schedule: string }>;
  };
  assert.deepEqual(config.crons, [{
    path: "/api/cron/storage-retention",
    schedule: "17 3 * * *",
  }]);
});
