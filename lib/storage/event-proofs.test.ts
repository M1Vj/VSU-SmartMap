import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createAdminEventProofSignedUrl,
  parseLegacyEventProofUrl,
  reclaimExpiredEventProofs,
} from "./event-proofs.ts";

const PROJECT_URL = "https://project-ref.supabase.co";
const SUGGESTION_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEMP_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const UPLOAD_ID = "7ba7b810-9dad-11d1-80b4-00c04fd430c9";

test("legacy proof parsing accepts only this project and known proof locations", () => {
  assert.deepEqual(
    parseLegacyEventProofUrl(
      `${PROJECT_URL}/storage/v1/object/public/smartmap-bucket/event-proofs/${TEMP_ID}/${UPLOAD_ID}.webp`,
      PROJECT_URL,
    ),
    {
      bucket: "smartmap-bucket",
      objectPath: `event-proofs/${TEMP_ID}/${UPLOAD_ID}.webp`,
    },
  );
  assert.deepEqual(
    parseLegacyEventProofUrl(
      `${PROJECT_URL}/storage/v1/object/public/event-proofs/${TEMP_ID}/${UPLOAD_ID}.png`,
      PROJECT_URL,
    ),
    {
      bucket: "event-proofs",
      objectPath: `${TEMP_ID}/${UPLOAD_ID}.png`,
    },
  );

  for (const value of [
    `https://attacker.test/storage/v1/object/public/event-proofs/${TEMP_ID}/${UPLOAD_ID}.png`,
    `${PROJECT_URL}/storage/v1/object/public/smartmap-bucket/facilities/${UPLOAD_ID}.png`,
    `${PROJECT_URL}/storage/v1/object/public/event-proofs/../../secrets.png`,
    `${PROJECT_URL}/storage/v1/object/public/event-proofs/${TEMP_ID}/${UPLOAD_ID}.svg`,
    `${PROJECT_URL}/storage/v1/object/public/event-proofs/${TEMP_ID}/${UPLOAD_ID}.png?token=secret`,
  ]) {
    assert.equal(parseLegacyEventProofUrl(value, PROJECT_URL), null, value);
  }
});

test("admin proof lookup signs a private path for at most 300 seconds", async () => {
  const calls: Array<{ bucket: string; path: string; ttl: number }> = [];
  const client = {
    from(table: string) {
      assert.equal(table, "event_suggestions");
      return {
        select(selection: string) {
          assert.doesNotMatch(selection, /title|description/);
          return {
            eq(column: string, value: string) {
              assert.deepEqual([column, value], ["id", SUGGESTION_ID]);
              return {
                async maybeSingle() {
                  return {
                    data: {
                      proof_object_path: `${TEMP_ID}/${UPLOAD_ID}.webp`,
                      proof_file_url: null,
                      proof_deleted_at: null,
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
    storage: {
      from(bucket: string) {
        return {
          async createSignedUrl(path: string, ttl: number) {
            calls.push({ bucket, path, ttl });
            return {
              data: {
                signedUrl: `${PROJECT_URL}/storage/v1/object/sign/event-proofs/${TEMP_ID}/${UPLOAD_ID}.webp?token=opaque`,
              },
              error: null,
            };
          },
        };
      },
    },
  };

  const result = await createAdminEventProofSignedUrl(
    client as never,
    SUGGESTION_ID,
    PROJECT_URL,
    999,
  );
  assert.equal(
    result,
    `${PROJECT_URL}/storage/v1/object/sign/event-proofs/${TEMP_ID}/${UPLOAD_ID}.webp?token=opaque`,
  );
  assert.deepEqual(calls, [{
    bucket: "event-proofs",
    path: `${TEMP_ID}/${UPLOAD_ID}.webp`,
    ttl: 300,
  }]);
});

test("admin proof lookup preserves a strictly matched legacy smartmap proof", async () => {
  const legacyPath = `event-proofs/${TEMP_ID}/${UPLOAD_ID}.webp`;
  const client = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: {
                      proof_object_path: null,
                      proof_file_url: `${PROJECT_URL}/storage/v1/object/public/smartmap-bucket/${legacyPath}`,
                      proof_deleted_at: null,
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
    storage: {
      from(bucket: string) {
        assert.equal(bucket, "smartmap-bucket");
        return {
          async createSignedUrl(path: string) {
            assert.equal(path, legacyPath);
            return {
              data: {
                signedUrl: `${PROJECT_URL}/storage/v1/object/sign/smartmap-bucket/${legacyPath}?token=opaque`,
              },
              error: null,
            };
          },
        };
      },
    },
  };

  assert.equal(
    await createAdminEventProofSignedUrl(client as never, SUGGESTION_ID, PROJECT_URL),
    `${PROJECT_URL}/storage/v1/object/sign/smartmap-bucket/${legacyPath}?token=opaque`,
  );
});

test("admin proof lookup rejects signed redirects with an unexpected origin, bucket, path, or encoding", async () => {
  const signedUrls = [
    `https://attacker.test/storage/v1/object/sign/event-proofs/${TEMP_ID}/${UPLOAD_ID}.webp?token=opaque`,
    `${PROJECT_URL}/storage/v1/object/sign/smartmap-bucket/event-proofs/${TEMP_ID}/${UPLOAD_ID}.webp?token=opaque`,
    `${PROJECT_URL}/storage/v1/object/sign/event-proofs/${TEMP_ID}/550e8400-e29b-41d4-a716-446655440000.webp?token=opaque`,
    `${PROJECT_URL}/storage/v1/object/sign/event-proofs/${TEMP_ID}/%2e%2e/${UPLOAD_ID}.webp?token=opaque`,
    `${PROJECT_URL}/storage/v1/object/public/event-proofs/${TEMP_ID}/${UPLOAD_ID}.webp?token=opaque`,
  ];
  const client = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: {
                      proof_object_path: `${TEMP_ID}/${UPLOAD_ID}.webp`,
                      proof_file_url: null,
                      proof_deleted_at: null,
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
    storage: {
      from() {
        return {
          async createSignedUrl() {
            return { data: { signedUrl: signedUrls.shift() }, error: null };
          },
        };
      },
    },
  };

  for (let index = 0; index < 5; index += 1) {
    assert.equal(
      await createAdminEventProofSignedUrl(client as never, SUGGESTION_ID, PROJECT_URL),
      null,
    );
  }
});

test("admin proof lookup hides invalid, missing, and deleted evidence without storage access", async () => {
  let storageCalls = 0;
  const client = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: {
                      proof_object_path: `${TEMP_ID}/${UPLOAD_ID}.webp`,
                      proof_file_url: null,
                      proof_deleted_at: "2026-07-16T00:00:00.000Z",
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
    storage: {
      from() {
        storageCalls += 1;
        throw new Error("must not access storage");
      },
    },
  };

  assert.equal(await createAdminEventProofSignedUrl(client as never, "bad-id", PROJECT_URL), null);
  assert.equal(await createAdminEventProofSignedUrl(client as never, SUGGESTION_ID, PROJECT_URL), null);
  assert.equal(storageCalls, 0);
});

test("admin proof lookup denies evidence after deletion has been claimed", async () => {
  let storageCalls = 0;
  const client = {
    from() {
      return {
        select(selection: string) {
          assert.match(selection, /proof_deletion_started_at/);
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: {
                      proof_object_path: `${TEMP_ID}/${UPLOAD_ID}.webp`,
                      proof_file_url: null,
                      proof_deleted_at: null,
                      proof_deletion_started_at: "2026-11-01T00:00:00.000Z",
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
    storage: {
      from() {
        storageCalls += 1;
        throw new Error("must not sign claimed evidence");
      },
    },
  };
  assert.equal(
    await createAdminEventProofSignedUrl(client as never, SUGGESTION_ID, PROJECT_URL),
    null,
  );
  assert.equal(storageCalls, 0);
});

test("expired decided proofs are claimed before storage deletion and completed with the same token", async () => {
  const actions: string[] = [];
  const rows = [{
    id: SUGGESTION_ID,
    proof_object_path: `${TEMP_ID}/${UPLOAD_ID}.webp`,
    claim_token: "8ba7b810-9dad-11d1-80b4-00c04fd430ca",
  }];
  const client = retentionClient(rows, actions);
  const result = await reclaimExpiredEventProofs({
    client: client as never,
    now: new Date("2026-11-01T00:00:00.000Z"),
  });
  assert.deepEqual(result, { scanned: 1, reclaimed: 1, retry: 0 });
  assert.deepEqual(actions, [
    "claim:2026-11-01T00:00:00.000Z:100:900",
    `remove:event-proofs/${TEMP_ID}/${UPLOAD_ID}.webp`,
    `complete:${SUGGESTION_ID}:8ba7b810-9dad-11d1-80b4-00c04fd430ca:2026-11-01T00:00:00.000Z`,
  ]);
});

test("failed storage deletion releases each matching claim for bounded retry", async () => {
  const actions: string[] = [];
  const rows = Array.from({ length: 101 }, (_, index) => ({
    id: `${index}`,
    proof_object_path: `${TEMP_ID}/${UPLOAD_ID}.webp`,
    claim_token: "8ba7b810-9dad-11d1-80b4-00c04fd430ca",
  }));
  const client = retentionClient(rows, actions, true);
  const result = await reclaimExpiredEventProofs({ client: client as never, batchSize: 10_000 });
  assert.deepEqual(result, { scanned: 100, reclaimed: 0, retry: 100 });
  assert.equal(actions.filter((action) => action.startsWith("release:")).length, 100);
  assert.equal(actions.filter((action) => action.startsWith("complete:")).length, 0);
});

test("extended or otherwise unclaimed rows are never sent to storage", async () => {
  const actions: string[] = [];
  const client = retentionClient([], actions);
  const result = await reclaimExpiredEventProofs({ client: client as never });
  assert.deepEqual(result, { scanned: 0, reclaimed: 0, retry: 0 });
  assert.equal(actions.filter((action) => action.startsWith("remove:")).length, 0);
});

test("a claim-token mismatch cannot complete deletion", async () => {
  const actions: string[] = [];
  const rows = [{
    id: SUGGESTION_ID,
    proof_object_path: `${TEMP_ID}/${UPLOAD_ID}.webp`,
    claim_token: "8ba7b810-9dad-11d1-80b4-00c04fd430ca",
  }];
  const client = retentionClient(rows, actions, false, false);
  const result = await reclaimExpiredEventProofs({ client: client as never });
  assert.deepEqual(result, { scanned: 1, reclaimed: 0, retry: 1 });
});

test("forward migration makes event proofs private without destroying legacy rows", async () => {
  const migration = await readFile(
    new URL("../../supabase/migrations/20260716001000_private_event_proofs.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /ALTER TABLE public\.event_suggestions[\s\S]+ADD COLUMN IF NOT EXISTS proof_object_path TEXT/i);
  assert.match(migration, /proof_file_url DROP NOT NULL/i);
  assert.match(migration, /proof_retain_until TIMESTAMPTZ/i);
  assert.match(migration, /proof_deleted_at TIMESTAMPTZ/i);
  assert.match(migration, /'event-proofs', 'event-proofs', false, 5242880/i);
  assert.match(migration, /ARRAY\['image\/jpeg', 'image\/png', 'image\/webp'\]/i);
  assert.match(migration, /DROP POLICY IF EXISTS "Public read event-proofs" ON storage\.objects/i);
  assert.match(migration, /DROP POLICY IF EXISTS "Authenticated upload event-proofs" ON storage\.objects/i);
  assert.doesNotMatch(migration, /CREATE POLICY[^;]+event-proofs/i);
  assert.match(migration, /proof_object_path[\s\S]+v_upload\.object_path/i);
  assert.match(migration, /proof_file_url[\s\S]+NULL/i);
  assert.doesNotMatch(migration, /DELETE FROM public\.event_suggestions/i);
});

function retentionClient(
  rows: Array<{ id: string; proof_object_path: string; claim_token: string }>,
  actions: string[],
  failStorage = false,
  completeResult = true,
) {
  return {
    async rpc(name: string, params: Record<string, unknown>) {
      if (name === "claim_expired_event_proofs") {
        actions.push(`claim:${params.p_now}:${params.p_limit}:${params.p_lease_seconds}`);
        return { data: rows.slice(0, Number(params.p_limit)), error: null };
      }
      if (name === "complete_event_proof_deletion") {
        actions.push(`complete:${params.p_suggestion_id}:${params.p_claim_token}:${params.p_deleted_at}`);
        return { data: completeResult, error: null };
      }
      if (name === "release_event_proof_deletion") {
        actions.push(`release:${params.p_suggestion_id}:${params.p_claim_token}`);
        return { data: true, error: null };
      }
      throw new Error(`unexpected RPC ${name}`);
    },
    storage: {
      from(bucket: string) {
        return {
          async remove(paths: string[]) {
            actions.push(`remove:${bucket}/${paths[0]}`);
            return { error: failStorage ? { message: "unavailable" } : null };
          },
        };
      },
    },
  };
}
