import assert from "node:assert/strict";
import test, { mock } from "node:test";

type PendingRow = { id: string; bucket: string; object_path: string };

let rows: PendingRow[] = [];
let queryError: { message: string } | null = null;
let storageErrors = new Map<string, { message: string; statusCode?: number }>();
let rowDeleteErrors = new Map<string, { message: string }>();
let selectedFilters: Array<[string, unknown]> = [];
let selectedLimit = 0;
let removedObjects: string[] = [];
let deletedRows: string[] = [];

mock.module("@/lib/supabase/server-client", {
  namedExports: {
    getSupabaseServiceRoleClient() {
      return {
        from(table: string) {
          assert.equal(table, "pending_suggestion_uploads");
          return {
            select() {
              const query = {
                is(column: string, value: unknown) {
                  selectedFilters.push([column, value]);
                  return query;
                },
                lt(column: string, value: unknown) {
                  selectedFilters.push([column, value]);
                  return query;
                },
                order() {
                  return query;
                },
                async limit(value: number) {
                  selectedLimit = value;
                  return { data: queryError ? null : rows, error: queryError };
                },
              };
              return query;
            },
            delete() {
              const query = {
                eq(column: string, id: string) {
                  assert.equal(column, "id");
                  deletedRows.push(id);
                  return query;
                },
                is(column: string, value: unknown) {
                  selectedFilters.push([column, value]);
                  return query;
                },
                async lt(column: string, value: unknown) {
                  selectedFilters.push([column, value]);
                  const id = deletedRows.at(-1)!;
                  const error = rowDeleteErrors.get(id) ?? null;
                  return { error, count: error ? null : 1 };
                },
              };
              return query;
            },
          };
        },
        storage: {
          from(bucket: string) {
            return {
              async remove(paths: string[]) {
                assert.equal(paths.length, 1);
                const key = `${bucket}/${paths[0]}`;
                removedObjects.push(key);
                return { data: null, error: storageErrors.get(key) ?? null };
              },
            };
          },
        },
      };
    },
  },
});

const cleanupModule = import("./pending-uploads.ts");

function reset() {
  rows = [];
  queryError = null;
  storageErrors = new Map();
  rowDeleteErrors = new Map();
  selectedFilters = [];
  selectedLimit = 0;
  removedObjects = [];
  deletedRows = [];
}

test.beforeEach(reset);

test("returns bounded zero counts when no expired unclaimed uploads match", async () => {
  const { reclaimExpiredPendingUploads } = await cleanupModule;
  const result = await reclaimExpiredPendingUploads({
    now: new Date("2026-07-16T00:00:00.000Z"),
  });
  assert.deepEqual(result, { scanned: 0, reclaimed: 0, retry: 0 });
  assert.deepEqual(selectedFilters.slice(0, 2), [
    ["claimed_at", null],
    ["expires_at", "2026-07-16T00:00:00.000Z"],
  ]);
});

test("removes storage before deleting each expired pending row", async () => {
  rows = [{ id: "upload-1", bucket: "smartmap-bucket", object_path: "suggestion-images/a.webp" }];
  const { reclaimExpiredPendingUploads } = await cleanupModule;
  const result = await reclaimExpiredPendingUploads({ now: new Date("2026-07-16T00:00:00.000Z") });
  assert.deepEqual(result, { scanned: 1, reclaimed: 1, retry: 0 });
  assert.deepEqual(removedObjects, ["smartmap-bucket/suggestion-images/a.webp"]);
  assert.deepEqual(deletedRows, ["upload-1"]);
});

test("retains the row for retry when storage removal fails", async () => {
  rows = [{ id: "upload-2", bucket: "smartmap-bucket", object_path: "event-proofs/b.webp" }];
  storageErrors.set("smartmap-bucket/event-proofs/b.webp", { message: "storage unavailable" });
  const { reclaimExpiredPendingUploads } = await cleanupModule;
  const result = await reclaimExpiredPendingUploads();
  assert.deepEqual(result, { scanned: 1, reclaimed: 0, retry: 1 });
  assert.deepEqual(deletedRows, []);
});

test("treats an already-missing object as removed and deletes its row", async () => {
  rows = [{ id: "upload-3", bucket: "smartmap-bucket", object_path: "event-proofs/c.webp" }];
  storageErrors.set("smartmap-bucket/event-proofs/c.webp", { message: "Object not found", statusCode: 404 });
  const { reclaimExpiredPendingUploads } = await cleanupModule;
  const result = await reclaimExpiredPendingUploads();
  assert.deepEqual(result, { scanned: 1, reclaimed: 1, retry: 0 });
  assert.deepEqual(deletedRows, ["upload-3"]);
});

test("reports retry when the row cannot be deleted after storage removal", async () => {
  rows = [{ id: "upload-4", bucket: "smartmap-bucket", object_path: "suggestion-images/d.webp" }];
  rowDeleteErrors.set("upload-4", { message: "database unavailable" });
  const { reclaimExpiredPendingUploads } = await cleanupModule;
  const result = await reclaimExpiredPendingUploads();
  assert.deepEqual(result, { scanned: 1, reclaimed: 0, retry: 1 });
});

test("caps cleanup batches even when a larger limit is requested", async () => {
  const { reclaimExpiredPendingUploads } = await cleanupModule;
  await reclaimExpiredPendingUploads({ batchSize: 10_000 });
  assert.equal(selectedLimit, 100);
});

test("query failures use a generic cleanup error", async () => {
  queryError = { message: "relation detail" };
  const { reclaimExpiredPendingUploads, PendingUploadCleanupError } = await cleanupModule;
  await assert.rejects(reclaimExpiredPendingUploads(), PendingUploadCleanupError);
});
