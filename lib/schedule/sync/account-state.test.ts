import assert from "node:assert/strict";
import test from "node:test";

import {
  createScheduleAccountGeneration,
  createScheduleAuthClient,
  isScheduleSupabasePublicConfigValid,
  readScopedScheduleConsent,
  resolveScheduleAuth,
  signOutGuestFirst,
  writeScopedScheduleConsent,
} from "./account-state";
import { accountScheduleScope } from "../scope";

const A = { id: "00000000-0000-4000-8000-000000000001", email: "a@example.test" };
const B = { id: "00000000-0000-4000-8000-000000000002", email: "b@example.test" };

test("disabled auth resolves guest without touching either auth adapter", async () => {
  let calls = 0;
  const state = await resolveScheduleAuth(false, {
    async getUser() { calls += 1; return { user: A }; },
    async getSessionUser() { calls += 1; return A; },
  }, true);
  assert.deepEqual(state, { kind: "guest" });
  assert.equal(calls, 0);
});

test("verified getUser is authoritative and never reads cached session", async () => {
  let sessionCalls = 0;
  const state = await resolveScheduleAuth(true, {
    async getUser() { return { user: A }; },
    async getSessionUser() { sessionCalls += 1; return B; },
  }, true);
  assert.deepEqual(state, {
    kind: "authenticated", userId: A.id, email: A.email, offlineVerified: true,
  });
  assert.equal(sessionCalls, 0);
});

test("a normal missing Supabase session is an ordinary guest without cache fallback", async () => {
  let sessionCalls = 0;
  const state = await resolveScheduleAuth(true, {
    async getUser() {
      return {
        user: null,
        error: Object.assign(new Error("missing"), {
          name: "AuthSessionMissingError",
          status: 400,
        }),
      };
    },
    async getSessionUser() { sessionCalls += 1; return A; },
  }, true);
  assert.deepEqual(state, { kind: "guest" });
  assert.equal(sessionCalls, 0);
});

test("a missing-session name is not accepted when a user is unexpectedly present", async () => {
  const state = await resolveScheduleAuth(true, {
    async getUser() {
      return {
        user: A,
        error: Object.assign(new Error("bad"), { name: "AuthSessionMissingError" }),
      };
    },
    async getSessionUser() { return B; },
  }, true);
  assert.deepEqual(state, { kind: "guest", authRequired: true });
});

test("public Supabase config accepts only absolute HTTP(S) URLs and nonblank keys", () => {
  for (const [url, key] of [
    ["https://example.supabase.co", "anon-key"],
    ["http://127.0.0.1:54321", "local-key"],
    ["http://localhost:54321", "local-key"],
  ]) assert.equal(isScheduleSupabasePublicConfigValid(url, key), true);

  for (const [url, key] of [
    [undefined, "key"],
    ["not-a-url", "key"],
    [" https://example.test", "key"],
    ["ftp://example.test", "key"],
    ["/relative", "key"],
    ["https://example.test", undefined],
    ["https://example.test", ""],
    ["https://example.test", "   "],
    ["https://example.test", " key "],
  ]) assert.equal(isScheduleSupabasePublicConfigValid(url, key), false);
});

test("malformed config and throwing client factories fail closed without listeners", () => {
  let factoryCalls = 0;
  const malformed = createScheduleAuthClient("not-a-url", "key", () => {
    factoryCalls += 1;
    return { auth: "unexpected" };
  });
  assert.deepEqual(malformed, { kind: "unavailable" });
  assert.equal(factoryCalls, 0);

  const thrown = createScheduleAuthClient("https://example.test", "key", () => {
    factoryCalls += 1;
    throw new Error("constructor detail");
  });
  assert.deepEqual(thrown, { kind: "unavailable" });
  assert.equal(factoryCalls, 1);
});

for (const authError of [
  Object.assign(new Error("rejected"), { status: 401 }),
  Object.assign(new Error("invalid"), { name: "AuthInvalidTokenResponseError" }),
  new Error("generic auth rejection"),
]) {
  test(`online ${authError.name} rejection never exposes cached scope`, async () => {
    const state = await resolveScheduleAuth(true, {
      async getUser() { return { error: authError }; },
      async getSessionUser() { return A; },
    }, true);
    assert.deepEqual(state, { kind: "guest", authRequired: true });
  });
}

for (const authError of [
  new TypeError("fetch failed"),
  Object.assign(new Error("retry"), { name: "AuthRetryableFetchError" }),
]) {
  test(`${authError.name} may select only the cached offline scope`, async () => {
    const state = await resolveScheduleAuth(true, {
      async getUser() { return { error: authError }; },
      async getSessionUser() { return A; },
    }, true);
    assert.deepEqual(state, {
      kind: "authenticated", userId: A.id, email: A.email, offlineVerified: false,
    });
  });
}

test("navigator offline allows cached scope without authorizing online use", async () => {
  const state = await resolveScheduleAuth(true, {
    async getUser() { return { error: new Error("unavailable") }; },
    async getSessionUser() { return A; },
  }, false);
  assert.equal(state.kind, "authenticated");
  if (state.kind === "authenticated") assert.equal(state.offlineVerified, false);
});

test("late account A consent cannot update account B or guest", async () => {
  const gate = createScheduleAccountGeneration();
  const scopeA = accountScheduleScope(A.id);
  const scopeB = accountScheduleScope(B.id);
  let release!: (value: { consentEnabled?: boolean }) => void;
  const delayed = new Promise<{ consentEnabled?: boolean }>((resolve) => { release = resolve; });
  const aToken = gate.begin(scopeA);
  const pendingA = readScopedScheduleConsent(scopeA, aToken, gate, async () => delayed);
  gate.begin(scopeB);
  release({ consentEnabled: true });
  assert.equal(await pendingA, undefined);
  gate.invalidate();
  assert.equal(gate.isCurrent(aToken, scopeA), false);
});

test("verified OAuth return reads prior explicit consent but never writes consent", async () => {
  const gate = createScheduleAccountGeneration();
  const scopeA = accountScheduleScope(A.id);
  let writes = 0;
  const token = gate.begin(scopeA);
  const value = await readScopedScheduleConsent(scopeA, token, gate, async () => ({ consentEnabled: false }));
  assert.equal(value, false);
  assert.equal(writes, 0);

  await writeScopedScheduleConsent(scopeA, token, gate, {
    async get() { return { consentEnabled: false }; },
    async put() { writes += 1; },
  });
  assert.equal(writes, 1);
});

test("explicit consent writes remain isolated by account scope", async () => {
  const gate = createScheduleAccountGeneration();
  const rows = new Map<string, boolean>();
  const scopeA = accountScheduleScope(A.id);
  const scopeB = accountScheduleScope(B.id);
  const tokenA = gate.begin(scopeA);
  await writeScopedScheduleConsent(scopeA, tokenA, gate, {
    async get(scope) { return { consentEnabled: rows.get(scope) }; },
    async put(row) { rows.set(row.scope, row.consentEnabled === true); },
  });
  gate.begin(scopeB);
  assert.equal(rows.get(scopeA), true);
  assert.equal(rows.get(scopeB), undefined);
});

test("signout publishes guest before awaiting and preserves guest on failure", async () => {
  const events: string[] = [];
  await assert.rejects(signOutGuestFirst(
    () => { events.push("guest"); },
    async () => { events.push("signout"); throw new Error("failed"); },
  ));
  assert.deepEqual(events, ["guest", "signout"]);
});
