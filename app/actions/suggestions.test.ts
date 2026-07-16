import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { mock } from "node:test";

let verifyCalls: Array<[string, string | undefined]> = [];
let verifyResult = { success: true, error: undefined as string | undefined };
let quotaCalls: Array<Record<string, unknown>> = [];
let quotaResult = { allowed: true, retryAfterSeconds: 0 };
let rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];
let rpcError: { message: string } | null = null;
let serviceClientCreations = 0;
let notificationShouldFail = false;

mock.module("next/cache", {
  namedExports: { revalidatePath() {} },
});

mock.module("next/headers", {
  namedExports: {
    async headers() {
      return new Headers({ "x-forwarded-for": "203.0.113.9" });
    },
  },
});

mock.module("@/lib/turnstile", {
  namedExports: {
    async verifyTurnstileToken(token: string, key?: string) {
      verifyCalls.push([token, key]);
      return verifyResult;
    },
  },
});

mock.module("@/lib/security/rate-limit", {
  namedExports: {
    hashRateLimitSubject(subject: string) {
      assert.equal(subject, "203.0.113.9");
      return "b".repeat(64);
    },
    async consumeRateLimit(input: Record<string, unknown>) {
      quotaCalls.push(input);
      return quotaResult;
    },
  },
});

mock.module("@/lib/supabase/server-client", {
  namedExports: {
    getSupabaseServiceRoleClient() {
      serviceClientCreations += 1;
      return {
        from() {
          throw new Error("public submissions must not use generic suggestion table writes");
        },
        async rpc(name: string, params: Record<string, unknown>) {
          rpcCalls.push({ name, params });
          return {
            data: rpcError ? null : {
              id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
              type: params.p_type,
              status: "PENDING",
              target_id: params.p_target_id,
              payload: params.p_payload,
              admin_note: null,
              created_at: "2026-07-16T00:00:00.000Z",
              updated_at: "2026-07-16T00:00:00.000Z",
            },
            error: rpcError,
          };
        },
      };
    },
  },
});

mock.module("@/lib/notifications/service", {
  namedExports: {
    async notifyAdmins() {
      if (notificationShouldFail) throw new Error("notification provider unavailable");
    },
  },
});

const suggestionsModule = import("./suggestions.ts");
const UPLOAD_ID = "550e8400-e29b-41d4-a716-446655440000";

function validInput(extra: Record<string, unknown> = {}) {
  return {
    type: "ADD_FACILITY",
    targetId: null,
    payload: {
      name: "Open Source Hall",
      category: "academic",
      coordinates: { lat: 10.7445, lng: 124.79194 },
      hasRooms: false,
    },
    ...extra,
  };
}

function reset() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  verifyCalls = [];
  verifyResult = { success: true, error: undefined };
  quotaCalls = [];
  quotaResult = { allowed: true, retryAfterSeconds: 0 };
  rpcCalls = [];
  rpcError = null;
  serviceClientCreations = 0;
  notificationShouldFail = false;
}

test.beforeEach(reset);

test("rejects forged status/admin fields and client-provided non-null image URLs", async () => {
  const { createSuggestionAction } = await suggestionsModule;
  for (const input of [
    validInput({ status: "APPROVED" }),
    validInput({ adminNote: "auto approve" }),
    validInput({ turnstileToken: "x".repeat(4097) }),
    validInput({ payload: { ...validInput().payload as object, imageUrl: "https://attacker.test/a.webp" } }),
  ]) {
    const result = await createSuggestionAction(input);
    assert.ok(result.error);
  }
  assert.equal(serviceClientCreations, 0);
});

test("text-only map suggestion verifies CAPTCHA, applies quota, and calls only the narrow RPC", async () => {
  const { createSuggestionAction } = await suggestionsModule;
  const result = await createSuggestionAction(validInput({
    turnstileToken: "captcha-token",
    turnstileIdempotencyKey: "captcha-idempotency",
  }));

  assert.equal(result.error, undefined);
  assert.deepEqual(verifyCalls, [["captcha-token", "captcha-idempotency"]]);
  assert.equal(quotaCalls.length, 1);
  assert.equal(rpcCalls[0]?.name, "submit_map_suggestion");
  assert.equal(rpcCalls[0]?.params.p_upload_id, null);
  assert.equal(rpcCalls[0]?.params.p_owner_hash, "b".repeat(64));
});

test("map suggestion with an upload skips CAPTCHA reuse and claims via the narrow RPC", async () => {
  const { createSuggestionAction } = await suggestionsModule;
  const result = await createSuggestionAction(validInput({ uploadId: UPLOAD_ID }));

  assert.equal(result.error, undefined);
  assert.equal(verifyCalls.length, 0);
  assert.equal(rpcCalls[0]?.params.p_upload_id, UPLOAD_ID);
  assert.match(String(rpcCalls[0]?.params.p_public_storage_base_url), /^https:\/\/project\.supabase\.co/);
});

test("explicit image removal is allowed without accepting an attacker URL", async () => {
  const { createSuggestionAction } = await suggestionsModule;
  const result = await createSuggestionAction(validInput({
    type: "EDIT_FACILITY",
    targetId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    payload: {
      name: "Open Source Hall",
      imageUrl: null,
    },
    turnstileToken: "captcha-token",
  }));
  assert.equal(result.error, undefined);
});

test("missing or failed CAPTCHA and quota failures stop before service-role access", async () => {
  const { createSuggestionAction } = await suggestionsModule;
  assert.ok((await createSuggestionAction(validInput())).error);
  assert.equal(serviceClientCreations, 0);

  verifyResult = { success: false, error: "provider detail" };
  assert.deepEqual(
    await createSuggestionAction(validInput({ turnstileToken: "bad" })),
    { error: "Unable to submit suggestion. Please try again." },
  );
  assert.equal(serviceClientCreations, 0);

  verifyResult = { success: true, error: undefined };
  quotaResult = { allowed: false, retryAfterSeconds: 60 };
  assert.ok((await createSuggestionAction(validInput({ turnstileToken: "ok" }))).error);
  assert.equal(serviceClientCreations, 0);
});

test("expired, cross-owner, replayed, and database errors stay generic", async () => {
  const { createSuggestionAction } = await suggestionsModule;
  for (const message of ["upload expired", "owner mismatch", "already claimed", "connection detail"]) {
    reset();
    rpcError = { message };
    assert.deepEqual(
      await createSuggestionAction(validInput({ uploadId: UPLOAD_ID })),
      { error: "Unable to submit suggestion. Please try again." },
    );
  }
});

test("a committed suggestion remains successful when best-effort notification fails", async () => {
  notificationShouldFail = true;
  const { createSuggestionAction } = await suggestionsModule;
  const result = await createSuggestionAction(validInput({ uploadId: UPLOAD_ID }));
  assert.equal(result.error, undefined);
  assert.equal(rpcCalls.length, 1);
});

test("migration keeps pending uploads private and claims them atomically in service-only RPCs", async () => {
  const migration = await readFile(
    new URL("../../supabase/migrations/20260716000500_harden_suggestion_submissions.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE public\.pending_suggestion_uploads/i);
  assert.match(
    migration,
    /DROP POLICY IF EXISTS "Public upload suggestion images" ON storage\.objects;/i,
  );
  assert.doesNotMatch(
    migration,
    /CREATE POLICY[^;]+(?:PUBLIC|anon)[\s\S]+suggestion-images/i,
  );
  assert.match(migration, /owner_hash TEXT NOT NULL/i);
  assert.match(migration, /claimed_at TIMESTAMPTZ/i);
  assert.match(migration, /expires_at TIMESTAMPTZ NOT NULL/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.submit_map_suggestion/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.submit_event_suggestion/i);
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.submit_event_suggestion[\s\S]+p_public_storage_base_url TEXT[\s\S]+storage\/v1\/object\/public/i,
  );
  assert.match(migration, /FOR UPDATE/i);
  assert.match(migration, /claimed_at IS NULL/i);
  assert.match(migration, /expires_at > statement_timestamp\(\)/i);
  assert.match(migration, /owner_hash = p_owner_hash/i);
  assert.match(migration, /status[^;]+PENDING/i);
  assert.match(migration, /status[^;]+pending/i);
  assert.match(migration, /REVOKE ALL ON TABLE public\.pending_suggestion_uploads\s+FROM PUBLIC, anon, authenticated, service_role/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.submit_map_suggestion[\s\S]+ TO service_role/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.submit_event_suggestion[\s\S]+ TO service_role/i);
  assert.doesNotMatch(migration, /GRANT EXECUTE[\s\S]+ TO (?:PUBLIC|anon|authenticated)/i);
});
