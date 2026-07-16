import assert from "node:assert/strict";
import test from "node:test";

import {
  parseLegacyProofUrl,
  runEventProofMigration,
} from "./migrate-event-proofs.mjs";

const PROJECT_URL = "https://project-ref.supabase.co";
const TEMP_ID = "550e8400-e29b-41d4-a716-446655440000";
const UPLOAD_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const LEGACY_URL = `${PROJECT_URL}/storage/v1/object/public/smartmap-bucket/event-proofs/${TEMP_ID}/${UPLOAD_ID}.webp`;

test("migration URL parser rejects foreign, encoded, queried, and unrelated URLs", () => {
  assert.deepEqual(parseLegacyProofUrl(LEGACY_URL, PROJECT_URL), {
    bucket: "smartmap-bucket",
    objectPath: `event-proofs/${TEMP_ID}/${UPLOAD_ID}.webp`,
    destinationPath: `${TEMP_ID}/${UPLOAD_ID}.webp`,
  });
  for (const value of [
    LEGACY_URL.replace("project-ref.supabase.co", "attacker.test"),
    LEGACY_URL.replace("event-proofs/", "event-proofs/%2e%2e/"),
    `${LEGACY_URL}?download=secret`,
    LEGACY_URL.replace("event-proofs/", "facility-images/"),
  ]) {
    assert.equal(parseLegacyProofUrl(value, PROJECT_URL), null);
  }
});

test("dry run inventories legacy suggestions and public event misuse without writes", async () => {
  const state = migrationClientState();
  state.suggestions = [{ id: "suggestion-1", proof_file_url: LEGACY_URL, proof_object_path: null }];
  state.events = [{ id: "event-1", image_url: LEGACY_URL }];
  const result = await runEventProofMigration({
    client: migrationClient(state),
    projectUrl: PROJECT_URL,
    apply: false,
    fetchImpl: async () => { throw new Error("dry run must not fetch"); },
    logger: { info() {}, error() {} },
  });
  assert.deepEqual(result, {
    apply: false,
    suggestionCandidates: 1,
    migratedSuggestions: 0,
    invalidSuggestionUrls: 0,
    eventImageCandidates: 1,
    clearedEventImages: 0,
    retry: 0,
  });
  assert.equal(state.writes, 0);
  assert.equal(state.storageCalls, 0);
});

test("a partial transfer failure never updates a row or deletes the public original", async () => {
  const state = migrationClientState();
  state.suggestions = [{ id: "suggestion-1", proof_file_url: LEGACY_URL, proof_object_path: null }];
  state.uploadFails = true;
  state.destinationDownloadFails = true;
  const result = await runEventProofMigration({
    client: migrationClient(state),
    projectUrl: PROJECT_URL,
    apply: true,
    logger: { info() {}, error() {} },
  });
  assert.equal(result.retry, 1);
  assert.equal(result.migratedSuggestions, 0);
  assert.equal(state.writes, 0);
  assert.deepEqual(state.removals, []);
});

test("rerun clears a stale legacy URL after the verified destination path survived and source deletion already happened", async () => {
  const state = migrationClientState();
  state.suggestions = [{
    id: "suggestion-1",
    proof_file_url: LEGACY_URL,
    proof_object_path: `${TEMP_ID}/${UPLOAD_ID}.webp`,
  }];
  state.sourceDownloadFails = true;
  state.sourceRemoveMissing = true;

  const result = await runEventProofMigration({
    client: migrationClient(state),
    projectUrl: PROJECT_URL,
    apply: true,
    logger: { info() {}, error() {} },
  });

  assert.equal(result.retry, 0);
  assert.equal(result.migratedSuggestions, 1);
  assert.equal(state.clearedLegacyUrls, 1);
  assert.equal(state.pathWrites, 0);
  assert.equal(state.destinationDownloads, 1);
});

test("inventory paginates every table in deterministic id order until a short page", async () => {
  const suggestions = Array.from({ length: 205 }, (_, index) => ({
    id: `suggestion-${String(index).padStart(3, "0")}`,
    proof_file_url: LEGACY_URL,
    proof_object_path: null,
  }));
  const events = Array.from({ length: 203 }, (_, index) => ({
    id: `event-${String(index).padStart(3, "0")}`,
    image_url: LEGACY_URL,
  }));
  const ranges = [];
  const client = paginationClient({ suggestions, events, ranges });
  const result = await runEventProofMigration({
    client,
    projectUrl: PROJECT_URL,
    apply: false,
    logger: { info() {}, error() {} },
  });
  assert.equal(result.suggestionCandidates, 205);
  assert.equal(result.eventImageCandidates, 203);
  assert.deepEqual(ranges, [
    ["event_suggestions", 0, 199],
    ["events", 0, 199],
    ["event_suggestions", 200, 399],
    ["events", 200, 399],
  ]);
});

test("compare-and-swap writes never clear concurrently changed URLs", async () => {
  const state = { suggestionCasChecked: false, eventCasChecked: false, removals: 0 };
  const result = await runEventProofMigration({
    client: concurrentMutationClient(state),
    projectUrl: PROJECT_URL,
    apply: true,
    logger: { info() {}, error() {} },
  });
  assert.equal(result.migratedSuggestions, 0);
  assert.equal(result.clearedEventImages, 0);
  assert.equal(result.retry, 2);
  assert.equal(state.suggestionCasChecked, true);
  assert.equal(state.eventCasChecked, true);
  assert.equal(state.removals, 0);
});

function paginationClient({ suggestions, events, ranges }) {
  return {
    from(table) {
      return {
        select() {
          return {
            order(column, options) {
              assert.equal(column, "id");
              assert.deepEqual(options, { ascending: true });
              return {
                async range(from, to) {
                  ranges.push([table, from, to]);
                  const rows = table === "event_suggestions" ? suggestions : events;
                  return { data: rows.slice(from, to + 1), error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

function concurrentMutationClient(state) {
  const bytes = new TextEncoder().encode("verified image bytes");
  const inventories = {
    event_suggestions: [{ id: "suggestion-1", proof_file_url: LEGACY_URL, proof_object_path: null }],
    events: [{ id: "event-1", image_url: LEGACY_URL }],
  };
  return {
    from(table) {
      return {
        select() {
          return {
            order() {
              return {
                async range(from, to) {
                  return { data: inventories[table].slice(from, to + 1), error: null };
                },
              };
            },
          };
        },
        update(value) {
          const predicates = [];
          const query = {
            eq(column, expected) {
              predicates.push([column, expected]);
              return query;
            },
            is(column, expected) {
              predicates.push([column, expected]);
              return Promise.resolve(finish());
            },
            then(resolve) { return resolve(finish()); },
          };
          function finish() {
            if (table === "event_suggestions" && "proof_object_path" in value) {
              assert.deepEqual(predicates, [
                ["id", "suggestion-1"],
                ["proof_file_url", LEGACY_URL],
                ["proof_object_path", null],
              ]);
              state.suggestionCasChecked = true;
            } else if (table === "events") {
              assert.deepEqual(predicates, [
                ["id", "event-1"],
                ["image_url", LEGACY_URL],
              ]);
              state.eventCasChecked = true;
            }
            return { error: null, count: 0 };
          }
          return query;
        },
      };
    },
    storage: {
      from() {
        return {
          async download() { return { data: new Blob([bytes], { type: "image/webp" }), error: null }; },
          async upload() { return { error: null }; },
          async remove() { state.removals += 1; return { error: null }; },
        };
      },
    },
  };
}

function migrationClientState() {
  return {
    suggestions: [],
    events: [],
    writes: 0,
    storageCalls: 0,
    removals: [],
    uploadFails: false,
    destinationDownloadFails: false,
    sourceDownloadFails: false,
    sourceRemoveMissing: false,
    destinationDownloads: 0,
    clearedLegacyUrls: 0,
    pathWrites: 0,
  };
}

function migrationClient(state) {
  const bytes = new TextEncoder().encode("verified image bytes");
  return {
    from(table) {
      return {
        select() {
          return {
            order(column, options) {
              assert.equal(column, "id");
              assert.deepEqual(options, { ascending: true });
              return {
                async range(from, to) {
                  const rows = table === "event_suggestions" ? state.suggestions : state.events;
                  return { data: rows.slice(from, to + 1), error: null };
                },
              };
            },
          };
        },
        update(value) {
          state.writes += 1;
          if ("proof_object_path" in value) state.pathWrites += 1;
          if ("proof_file_url" in value) state.clearedLegacyUrls += 1;
          const query = {
            eq() { return query; },
            async is() { return { error: null, count: 1 }; },
            then(resolve) { return resolve({ error: null, count: 1 }); },
          };
          return query;
        },
      };
    },
    storage: {
      from(bucket) {
        return {
          async download(path) {
            state.storageCalls += 1;
            const destination = bucket === "event-proofs" && !path.startsWith("event-proofs/");
            if (destination) state.destinationDownloads += 1;
            if (!destination && state.sourceDownloadFails) {
              return { data: null, error: { message: "not found", statusCode: 404 } };
            }
            if (destination && state.destinationDownloadFails) {
              return { data: null, error: { message: "missing" } };
            }
            return { data: new Blob([bytes], { type: "image/webp" }), error: null };
          },
          async upload() {
            state.storageCalls += 1;
            return { error: state.uploadFails ? { message: "upload failed" } : null };
          },
          async remove(paths) {
            state.storageCalls += 1;
            state.removals.push({ bucket, paths });
            return {
              error: state.sourceRemoveMissing
                ? { message: "Object not found", statusCode: 404 }
                : null,
            };
          },
        };
      },
    },
  };
}
