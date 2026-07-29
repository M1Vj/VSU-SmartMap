import assert from "node:assert/strict";
import test, { mock } from "node:test";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";
const CLAIM_TOKEN = "44444444-4444-4444-8444-444444444444";
const PATH = `${USER_ID}/${APPLICATION_ID}/identity-1720000000000-card.pdf`;
const NOW = new Date("2026-07-29T00:00:00.000Z");

const originalEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

let defaultClientCalls = 0;
mock.module("@/lib/supabase/server-client", {
  namedExports: {
    getSupabaseServiceRoleClient() {
      defaultClientCalls += 1;
      return retentionClient([]);
    },
  },
});

const cleanupModule = import("./verification-documents.ts");

type ClaimRow = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  claim_token: string;
};

function retentionClient(
  rows: ClaimRow[],
  options?: {
    claimError?: boolean;
    storageError?: { message: string; statusCode?: number; code?: string };
    completeResult?: boolean;
    completeError?: boolean;
  },
) {
  const actions: string[] = [];
  return {
    actions,
    async rpc(name: string, parameters: Record<string, unknown>) {
      if (name === "claim_expired_verification_documents") {
        actions.push(`claim:${parameters.p_now}:${parameters.p_limit}:${parameters.p_lease_seconds}`);
        return {
          data: options?.claimError ? null : rows.slice(0, Number(parameters.p_limit)),
          error: options?.claimError ? { message: "private claim detail" } : null,
        };
      }
      if (name === "complete_verification_document_deletion") {
        actions.push(`complete:${parameters.p_document_id}:${parameters.p_claim_token}`);
        return {
          data: options?.completeResult ?? true,
          error: options?.completeError ? { message: "private completion detail" } : null,
        };
      }
      if (name === "release_verification_document_deletion") {
        actions.push(`release:${parameters.p_document_id}:${parameters.p_claim_token}`);
        return { data: true, error: null };
      }
      throw new Error(`unexpected RPC ${name}`);
    },
    storage: {
      from(bucket: string) {
        return {
          async remove(paths: string[]) {
            actions.push(`remove:${bucket}/${paths[0]}`);
            return { data: null, error: options?.storageError ?? null };
          },
        };
      },
    },
  };
}

function row(overrides: Partial<ClaimRow> = {}): ClaimRow {
  return {
    id: DOCUMENT_ID,
    storage_bucket: "boarding-house-verification",
    storage_path: PATH,
    claim_token: CLAIM_TOKEN,
    ...overrides,
  };
}

function reset() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project-ref.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  defaultClientCalls = 0;
}

test.beforeEach(reset);
test.after(() => {
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("fails closed before client creation when service credentials or time are invalid", async () => {
  const { reclaimExpiredVerificationDocuments, VerificationDocumentCleanupError } =
    await cleanupModule;
  for (const missing of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    reset();
    delete process.env[missing];
    await assert.rejects(reclaimExpiredVerificationDocuments(), VerificationDocumentCleanupError);
    assert.equal(defaultClientCalls, 0);
  }
  await assert.rejects(
    reclaimExpiredVerificationDocuments({ now: new Date("invalid") }),
    VerificationDocumentCleanupError,
  );
});

test("bounds claims at 100 and removes storage before completing the exact claim", async () => {
  const client = retentionClient([row()]);
  const { reclaimExpiredVerificationDocuments } = await cleanupModule;
  const result = await reclaimExpiredVerificationDocuments({
    client: client as never,
    now: NOW,
    batchSize: 10_000,
  });
  assert.deepEqual(result, { scanned: 1, reclaimed: 1, retry: 0 });
  assert.deepEqual(client.actions, [
    `claim:${NOW.toISOString()}:100:900`,
    `remove:boarding-house-verification/${PATH}`,
    `complete:${DOCUMENT_ID}:${CLAIM_TOKEN}`,
  ]);
  assert.equal(client.actions.some((action) => action.includes("delete_expired_verification_documents")), false);
});

test("treats a confirmed missing object as removed before completing", async () => {
  const client = retentionClient([row()], {
    storageError: { message: "Object not found", statusCode: 404 },
  });
  const { reclaimExpiredVerificationDocuments } = await cleanupModule;
  assert.deepEqual(
    await reclaimExpiredVerificationDocuments({ client: client as never, now: NOW }),
    { scanned: 1, reclaimed: 1, retry: 0 },
  );
  assert.match(client.actions.at(-1) ?? "", /^complete:/);
});

test("releases the exact claim when storage removal fails", async () => {
  const client = retentionClient([row()], {
    storageError: { message: "storage unavailable" },
  });
  const { reclaimExpiredVerificationDocuments } = await cleanupModule;
  assert.deepEqual(
    await reclaimExpiredVerificationDocuments({ client: client as never, now: NOW }),
    { scanned: 1, reclaimed: 0, retry: 1 },
  );
  assert.match(client.actions.at(-1) ?? "", /^release:/);
});

test("retains the claimed row for stale-lease retry when completion fails", async () => {
  const client = retentionClient([row()], { completeResult: false });
  const { reclaimExpiredVerificationDocuments } = await cleanupModule;
  assert.deepEqual(
    await reclaimExpiredVerificationDocuments({ client: client as never, now: NOW }),
    { scanned: 1, reclaimed: 0, retry: 1 },
  );
  assert.equal(client.actions.some((action) => action.startsWith("release:")), false);
});

test("releases invalid bucket and unsafe path claims without touching storage", async () => {
  const client = retentionClient([
    row({ storage_bucket: "smartmap-bucket" }),
    row({
      id: "55555555-5555-4555-8555-555555555555",
      claim_token: "66666666-6666-4666-8666-666666666666",
      storage_path: `${USER_ID}/${APPLICATION_ID}/../private.pdf`,
    }),
  ]);
  const { reclaimExpiredVerificationDocuments } = await cleanupModule;
  assert.deepEqual(
    await reclaimExpiredVerificationDocuments({ client: client as never, now: NOW }),
    { scanned: 2, reclaimed: 0, retry: 2 },
  );
  assert.equal(client.actions.some((action) => action.startsWith("remove:")), false);
  assert.equal(client.actions.filter((action) => action.startsWith("release:")).length, 2);
});

test("claim failures use a generic cleanup error", async () => {
  const client = retentionClient([], { claimError: true });
  const { reclaimExpiredVerificationDocuments, VerificationDocumentCleanupError } =
    await cleanupModule;
  await assert.rejects(
    reclaimExpiredVerificationDocuments({ client: client as never, now: NOW }),
    (error: unknown) =>
      error instanceof VerificationDocumentCleanupError
      && error.message === "Unable to reclaim verification documents."
      && !error.message.includes("private"),
  );
});
