import assert from "node:assert/strict";
import test from "node:test";
import {
  initialScheduleSyncState,
  reduceScheduleSyncState,
  scheduleSyncStatus,
} from "./state";

const accountA = "00000000-0000-4000-8000-000000000001";
const accountB = "00000000-0000-4000-8000-000000000002";

test("offline edits, reconnect, push, pull, and acknowledgement preserve exact counts", () => {
  let state = initialScheduleSyncState;
  state = reduceScheduleSyncState(state, {
    type: "AUTH_CHANGED",
    accountId: accountA,
    pending: 0,
    conflicts: 0,
  });
  state = reduceScheduleSyncState(state, { type: "OFFLINE", pending: 2 });
  assert.deepEqual(scheduleSyncStatus(state), { kind: "offline", pending: 2 });
  state = reduceScheduleSyncState(state, { type: "ONLINE" });
  assert.deepEqual(scheduleSyncStatus(state), { kind: "pending", pending: 2 });
  state = reduceScheduleSyncState(state, { type: "PUSH_STARTED" });
  assert.deepEqual(scheduleSyncStatus(state), { kind: "syncing", pending: 2 });
  state = reduceScheduleSyncState(state, {
    type: "PUSH_ACKNOWLEDGED",
    pending: 1,
    lastSyncedAt: "2026-01-01T00:00:00.000Z",
  });
  state = reduceScheduleSyncState(state, {
    type: "PULL_APPLIED",
    pending: 1,
    conflicts: 0,
    lastSyncedAt: "2026-01-02T00:00:00.000Z",
  });
  assert.deepEqual(scheduleSyncStatus(state), { kind: "pending", pending: 1 });
});

test("conflicts outrank saved and remain after a push acknowledgement", () => {
  let state = reduceScheduleSyncState(initialScheduleSyncState, {
    type: "AUTH_CHANGED",
    accountId: accountA,
    pending: 2,
    conflicts: 1,
  });
  state = reduceScheduleSyncState(state, {
    type: "PUSH_ACKNOWLEDGED",
    pending: 0,
    lastSyncedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.deepEqual(scheduleSyncStatus(state), {
    kind: "needs-review",
    conflicts: 1,
  });
  state = reduceScheduleSyncState(state, { type: "CONFLICT", conflicts: 0 });
  assert.deepEqual(scheduleSyncStatus(state), {
    kind: "saved",
    lastSyncedAt: "2026-01-01T00:00:00.000Z",
  });
});

test("auth expiry and offline precedence retain pending and conflict counts", () => {
  let state = reduceScheduleSyncState(initialScheduleSyncState, {
    type: "AUTH_CHANGED",
    accountId: accountA,
    pending: 3,
    conflicts: 2,
  });
  state = reduceScheduleSyncState(state, { type: "OFFLINE", pending: 4 });
  assert.deepEqual(scheduleSyncStatus(state), { kind: "offline", pending: 4 });
  state = reduceScheduleSyncState(state, { type: "AUTH_EXPIRED" });
  assert.deepEqual(scheduleSyncStatus(state), {
    kind: "auth-required",
    pending: 4,
  });
  assert.equal(state.conflicts, 2);
});

test("failed retry uses generic text and can resume syncing", () => {
  let state = reduceScheduleSyncState(initialScheduleSyncState, {
    type: "AUTH_CHANGED",
    accountId: accountA,
    pending: 1,
    conflicts: 0,
  });
  state = reduceScheduleSyncState(state, { type: "FAILED" });
  assert.deepEqual(scheduleSyncStatus(state), {
    kind: "error",
    message: "Schedule sync failed. Try again.",
    pending: 1,
  });
  state = reduceScheduleSyncState(state, { type: "PUSH_STARTED" });
  assert.deepEqual(scheduleSyncStatus(state), { kind: "syncing", pending: 1 });
});

test("account switch and sign-out reset account state without leaking counts", () => {
  let state = reduceScheduleSyncState(initialScheduleSyncState, {
    type: "AUTH_CHANGED",
    accountId: accountA,
    pending: 4,
    conflicts: 3,
  });
  state = reduceScheduleSyncState(state, {
    type: "AUTH_CHANGED",
    accountId: accountB,
    pending: 1,
    conflicts: 0,
  });
  assert.equal(state.accountId, accountB);
  assert.deepEqual(scheduleSyncStatus(state), { kind: "pending", pending: 1 });
  state = reduceScheduleSyncState(state, {
    type: "AUTH_CHANGED",
    accountId: undefined,
    pending: 0,
    conflicts: 0,
  });
  assert.deepEqual(scheduleSyncStatus(state), { kind: "guest" });
});

test("negative or non-integer counts are rejected", () => {
  assert.throws(
    () =>
      reduceScheduleSyncState(initialScheduleSyncState, {
        type: "OFFLINE",
        pending: -1,
      }),
    /count/i,
  );
  assert.throws(
    () =>
      reduceScheduleSyncState(initialScheduleSyncState, {
        type: "CONFLICT",
        conflicts: 1.5,
      }),
    /count/i,
  );
});
