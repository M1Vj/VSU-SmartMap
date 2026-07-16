import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { mock } from "node:test";

type QueryResult = {
  data: unknown;
  error: null;
};

const eventRow = {
  id: "event-1",
  title: "Founders Day",
  description: null,
  start_time: "2026-08-01T08:00:00.000Z",
  end_time: "2026-08-01T10:00:00.000Z",
  location_text: "Main Campus",
  location_id: null,
  category: "cultural",
  image_url: null,
  created_at: "2026-07-16T00:00:00.000Z",
  updated_at: "2026-07-16T00:00:00.000Z",
};

const suggestionRow = {
  id: "suggestion-1",
  title: "Founders Day",
  description: null,
  start_time: "2026-08-01T08:00:00.000Z",
  end_time: "2026-08-01T10:00:00.000Z",
  location_text: "Main Campus",
  category: "cultural",
  proof_file_url: "https://example.com/proof.webp",
  proof_object_path: "6ba7b810-9dad-11d1-80b4-00c04fd430c8/7ba7b810-9dad-11d1-80b4-00c04fd430c9.webp",
  decided_at: null,
  proof_retain_until: null,
  proof_deleted_at: null,
  status: "pending",
  submitted_by: null,
  created_at: "2026-07-16T00:00:00.000Z",
};

function createQuery(table: string) {
  let operation = "select";

  const query = {
    select() {
      return query;
    },
    insert(value: Record<string, unknown>) {
      operation = "insert";
      inserts.push({ table, value });
      return query;
    },
    update(value: Record<string, unknown>) {
      operation = "update";
      updates.push({ table, value });
      return query;
    },
    delete() {
      operation = "delete";
      return query;
    },
    eq() {
      return query;
    },
    order() {
      return query;
    },
    single() {
      return Promise.resolve(result(false));
    },
    then<TResult1 = QueryResult, TResult2 = never>(
      onFulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve(result(true)).then(onFulfilled, onRejected);
    },
  };

  function result(isCollection: boolean): QueryResult {
    if (operation === "delete") return { data: null, error: null };
    if (table === "events") return { data: eventRow, error: null };
    if (operation === "select" && isCollection) {
      return { data: [suggestionRow], error: null };
    }
    return { data: suggestionRow, error: null };
  }

  return query;
}

let adminSession: { error: string } | {
  serviceClient: { from: (table: string) => ReturnType<typeof createQuery> };
} = { error: "Unauthorized" };
let adminAssertionCalls = 0;
let protectedServiceQueries = 0;
let legacyServerClientCalls = 0;
let legacyServiceClientCalls = 0;
let submissionRpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];
let submissionRpcError: { message: string } | null = null;
let submissionQuotaAllowed = true;
let inserts: Array<{ table: string; value: Record<string, unknown> }> = [];
let updates: Array<{ table: string; value: Record<string, unknown> }> = [];
let adminRpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];
let adminRpcError: { message: string } | null = null;

const sessionServiceClient = {
  from(table: string) {
    protectedServiceQueries += 1;
    return createQuery(table);
  },
  async rpc(name: string, params: Record<string, unknown>) {
    adminRpcCalls.push({ name, params });
    return {
      data: adminRpcError ? null : name === "reject_event_suggestion" ? {
        ...suggestionRow,
        status: "rejected",
        decided_at: "2026-07-16T00:00:00.000Z",
        proof_retain_until: "2026-08-15T00:00:00.000Z",
      } : eventRow,
      error: adminRpcError,
    };
  },
};

mock.module("next/cache", {
  namedExports: {
    revalidatePath() {},
    updateTag() {},
    unstable_cache<T extends (...args: never[]) => unknown>(fn: T) {
      return fn;
    },
  },
});

mock.module("next/headers", {
  namedExports: {
    async headers() {
      return new Headers({ "x-forwarded-for": "203.0.113.15" });
    },
  },
});

mock.module("@/lib/security/rate-limit", {
  namedExports: {
    hashRateLimitSubject(subject: string) {
      assert.equal(subject, "203.0.113.15");
      return "c".repeat(64);
    },
    async consumeRateLimit() {
      return { allowed: submissionQuotaAllowed, retryAfterSeconds: 60 };
    },
  },
});

mock.module("@/lib/auth/server", {
  namedExports: {
    async assertAdminAction() {
      adminAssertionCalls += 1;
      return adminSession;
    },
  },
});

mock.module("@/lib/supabase/server-client", {
  namedExports: {
    async getSupabaseServerClient() {
      legacyServerClientCalls += 1;
      throw new Error("protected action constructed the legacy server client");
    },
    getSupabaseServiceRoleClient() {
      legacyServiceClientCalls += 1;
      return {
        from() {
          throw new Error("event submissions must not use generic table writes");
        },
        async rpc(name: string, params: Record<string, unknown>) {
          submissionRpcCalls.push({ name, params });
          return {
            data: submissionRpcError ? null : suggestionRow,
            error: submissionRpcError,
          };
        },
      };
    },
  },
});

const eventsModule = import("./events.ts");

async function getProtectedCalls() {
  const {
    approveEventSuggestion,
    createEvent,
    deleteEvent,
    getEventSuggestions,
    rejectEventSuggestion,
    updateEvent,
  } = await eventsModule;

  return [
    ["createEvent", () => createEvent(null)],
    ["updateEvent", () => updateEvent("event-1", null)],
    ["deleteEvent", () => deleteEvent("event-1")],
    ["getEventSuggestions", () => getEventSuggestions("pending")],
    ["approveEventSuggestion", () => approveEventSuggestion("suggestion-1")],
    ["rejectEventSuggestion", () => rejectEventSuggestion("suggestion-1")],
  ] as const;
}

async function assertProtectedCallsAreDenied() {
  const protectedCalls = await getProtectedCalls();
  for (const [name, call] of protectedCalls) {
    const result = await call();
    assert.equal(result.error?.message, "Unauthorized", name);
    if (name === "getEventSuggestions") {
      assert.deepEqual(result.data, [], name);
    } else {
      assert.equal(result.data, null, name);
    }
  }
}

function resetCounters() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  adminAssertionCalls = 0;
  protectedServiceQueries = 0;
  legacyServerClientCalls = 0;
  legacyServiceClientCalls = 0;
  submissionRpcCalls = [];
  submissionRpcError = null;
  submissionQuotaAllowed = true;
  inserts = [];
  updates = [];
  adminRpcCalls = [];
  adminRpcError = null;
}

test("anonymous callers cannot run protected event actions before validation or service access", async () => {
  resetCounters();
  adminSession = { error: "Unauthorized" };

  await assertProtectedCallsAreDenied();

  assert.equal(adminAssertionCalls, (await getProtectedCalls()).length);
  assert.equal(protectedServiceQueries, 0);
  assert.equal(legacyServerClientCalls, 0);
  assert.equal(legacyServiceClientCalls, 0);
});

test("ordinary authenticated callers cannot run protected event actions or service queries", async () => {
  resetCounters();
  adminSession = { error: "Unauthorized" };

  await assertProtectedCallsAreDenied();

  assert.equal(adminAssertionCalls, (await getProtectedCalls()).length);
  assert.equal(protectedServiceQueries, 0);
  assert.equal(legacyServerClientCalls, 0);
  assert.equal(legacyServiceClientCalls, 0);
});

test("authorized event actions use only the service client returned by assertAdminAction", async () => {
  resetCounters();
  adminSession = { serviceClient: sessionServiceClient };
  const {
    approveEventSuggestion,
    createEvent,
    deleteEvent,
    getEventSuggestions,
    rejectEventSuggestion,
    updateEvent,
  } = await eventsModule;

  const input = {
    title: "Founders Day",
    startTime: "2026-08-01T08:00:00.000Z",
    endTime: "2026-08-01T10:00:00.000Z",
    category: "cultural",
  };

  const results = [
    await createEvent(input),
    await updateEvent("event-1", { title: "Updated Founders Day" }),
    await deleteEvent("event-1"),
    await getEventSuggestions("pending"),
    await approveEventSuggestion("suggestion-1"),
    await rejectEventSuggestion("suggestion-1"),
  ];

  assert.ok(results.every((result) => result.error === null));
  assert.equal(adminAssertionCalls, (await getProtectedCalls()).length);
  assert.equal(protectedServiceQueries, 4);
  assert.deepEqual(adminRpcCalls, [
    {
      name: "approve_event_suggestion",
      params: { p_suggestion_id: "suggestion-1" },
    },
    {
      name: "reject_event_suggestion",
      params: { p_suggestion_id: "suggestion-1" },
    },
  ]);
  assert.equal(legacyServerClientCalls, 0);
  assert.equal(legacyServiceClientCalls, 0);
});

test("event submissions reject proof URL injection and forged moderation fields", async () => {
  resetCounters();
  const { submitEventSuggestion } = await eventsModule;
  const base = {
    title: "Founders Day",
    startTime: "2026-08-01T08:00:00.000Z",
    endTime: "2026-08-01T10:00:00.000Z",
    locationText: "Main Campus",
    category: "cultural",
    uploadId: "550e8400-e29b-41d4-a716-446655440000",
  };

  for (const input of [
    { ...base, proofFileUrl: "https://attacker.test/proof.webp" },
    { ...base, status: "approved" },
    { ...base, submittedBy: "admin-user" },
  ]) {
    const result = await submitEventSuggestion(input);
    assert.equal(result.error?.message, "Unable to submit suggestion. Please try again.");
  }
  assert.equal(legacyServiceClientCalls, 0);
});

test("event submission applies quota and atomically claims only an event-proof upload", async () => {
  resetCounters();
  const { submitEventSuggestion } = await eventsModule;
  const uploadId = "550e8400-e29b-41d4-a716-446655440000";
  const result = await submitEventSuggestion({
    title: "Founders Day",
    description: "Annual celebration",
    startTime: "2026-08-01T08:00:00.000Z",
    endTime: "2026-08-01T10:00:00.000Z",
    locationText: "Main Campus",
    category: "cultural",
    uploadId,
  });

  assert.equal(result.error, null);
  assert.equal(legacyServiceClientCalls, 1);
  assert.equal(submissionRpcCalls[0]?.name, "submit_event_suggestion");
  assert.equal(submissionRpcCalls[0]?.params.p_upload_id, uploadId);
  assert.equal(submissionRpcCalls[0]?.params.p_owner_hash, "c".repeat(64));
  assert.equal("p_public_storage_base_url" in (submissionRpcCalls[0]?.params ?? {}), false);
  assert.equal("p_proof_file_url" in (submissionRpcCalls[0]?.params ?? {}), false);
});

test("admin suggestion results expose only a guarded proof capability", async () => {
  resetCounters();
  adminSession = { serviceClient: sessionServiceClient };
  const { getEventSuggestions } = await eventsModule;
  const result = await getEventSuggestions("pending");
  const suggestion = result.data?.[0] as unknown as Record<string, unknown>;
  assert.equal(suggestion.proofAvailable, true);
  assert.equal("proofFileUrl" in suggestion, false);
  assert.equal("proofObjectPath" in suggestion, false);
});

test("approval uses one atomic RPC and never issues generic event or suggestion writes", async () => {
  resetCounters();
  adminSession = { serviceClient: sessionServiceClient };
  const { approveEventSuggestion } = await eventsModule;
  const result = await approveEventSuggestion("suggestion-1");
  assert.equal(result.error, null);
  assert.deepEqual(adminRpcCalls, [{
    name: "approve_event_suggestion",
    params: { p_suggestion_id: "suggestion-1" },
  }]);
  assert.equal(protectedServiceQueries, 0);
  assert.equal(inserts.length, 0);
  assert.equal(updates.length, 0);
});

test("a failed atomic approval returns no event and one retry cannot duplicate client-side work", async () => {
  resetCounters();
  adminSession = { serviceClient: sessionServiceClient };
  adminRpcError = { message: "approval failed" };
  const { approveEventSuggestion } = await eventsModule;
  const failed = await approveEventSuggestion("suggestion-1");
  assert.equal(failed.data, null);
  assert.equal(failed.error?.message, "approval failed");
  assert.equal(adminRpcCalls.length, 1);
  assert.equal(protectedServiceQueries, 0);

  adminRpcError = null;
  const retry = await approveEventSuggestion("suggestion-1");
  assert.equal(retry.error, null);
  assert.equal(adminRpcCalls.length, 2);
  assert.equal(protectedServiceQueries, 0);
});

test("rejection uses one pending-only atomic RPC without generic writes or deletion", async () => {
  resetCounters();
  adminSession = { serviceClient: sessionServiceClient };
  const { rejectEventSuggestion } = await eventsModule;
  const result = await rejectEventSuggestion("suggestion-1");
  assert.equal(result.error, null);
  assert.deepEqual(adminRpcCalls, [{
    name: "reject_event_suggestion",
    params: { p_suggestion_id: "suggestion-1" },
  }]);
  assert.equal(protectedServiceQueries, 0);
  assert.equal(updates.length, 0);
});

test("approval migration is fixed-search-path, service-only, atomic, and never copies proof into image_url", async () => {
  const migration = await readFile(
    new URL("../../supabase/migrations/20260716001100_atomic_event_moderation.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.approve_event_suggestion\(p_suggestion_id UUID\)/i);
  assert.match(migration, /SECURITY DEFINER[\s\S]+SET search_path = ''/i);
  assert.match(migration, /FROM public\.event_suggestions[\s\S]+status = 'pending'[\s\S]+FOR UPDATE/i);
  assert.match(migration, /INSERT INTO public\.events[\s\S]+image_url[\s\S]+NULL/i);
  assert.match(migration, /UPDATE public\.event_suggestions[\s\S]+status = 'approved'[\s\S]+proof_retain_until[\s\S]+interval '90 days'/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.approve_event_suggestion\(UUID\)[\s\S]+FROM PUBLIC, anon, authenticated, service_role/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.approve_event_suggestion\(UUID\)[\s\S]+TO service_role/i);
  assert.doesNotMatch(migration, /proof_file_url[\s\S]+INSERT INTO public\.events/i);
});

test("lifecycle migration makes rejection and proof deletion claims service-only and atomic", async () => {
  const migration = await readFile(
    new URL("../../supabase/migrations/20260716001200_event_proof_lifecycle_races.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /ADD COLUMN IF NOT EXISTS proof_deletion_started_at TIMESTAMPTZ/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS proof_deletion_claim_token UUID/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.reject_event_suggestion\(p_suggestion_id UUID\)/i);
  assert.match(migration, /status = 'pending'[\s\S]+FOR UPDATE/i);
  assert.match(migration, /status = 'rejected'[\s\S]+interval '30 days'/i);
  for (const name of [
    "reject_event_suggestion",
    "claim_expired_event_proofs",
    "complete_event_proof_deletion",
    "release_event_proof_deletion",
  ]) {
    assert.match(migration, new RegExp(`SECURITY DEFINER[\\s\\S]+SET search_path = ''`, "i"));
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}`, "i"));
    assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}[\\s\\S]+TO service_role`, "i"));
  }
  assert.match(migration, /FOR UPDATE SKIP LOCKED/i);
  assert.match(migration, /proof_retain_until < p_now/i);
  assert.match(migration, /proof_deletion_claim_token = p_claim_token/i);
});

test("event submission returns generic errors for quota, cross-owner, expired, replayed, and DB failures", async () => {
  resetCounters();
  const { submitEventSuggestion } = await eventsModule;
  const input = {
    title: "Founders Day",
    startTime: "2026-08-01T08:00:00.000Z",
    endTime: "2026-08-01T10:00:00.000Z",
    locationText: "Main Campus",
    category: "cultural",
    uploadId: "550e8400-e29b-41d4-a716-446655440000",
  };

  submissionQuotaAllowed = false;
  assert.equal((await submitEventSuggestion(input)).error?.message, "Unable to submit suggestion. Please try again.");
  assert.equal(legacyServiceClientCalls, 0);

  for (const message of ["owner mismatch", "expired", "already claimed", "database unavailable"]) {
    resetCounters();
    submissionRpcError = { message };
    assert.equal((await submitEventSuggestion(input)).error?.message, "Unable to submit suggestion. Please try again.");
  }
});
