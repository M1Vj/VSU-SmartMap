import assert from "node:assert/strict";
import test from "node:test";
import {
  initialScheduleSyncState,
  reduceScheduleSyncState,
  scheduleSyncStatus,
} from "./state";
import type {
  ScheduleSyncEvent,
  ScheduleSyncReducerState,
} from "./types";

const accountA = "00000000-0000-4000-8000-000000000001";
const accountB = "00000000-0000-4000-8000-000000000002";
const runContext = (state: ScheduleSyncReducerState, runToken = 1) => ({
  accountId: state.accountId!,
  generation: state.generation,
  runToken,
});

test("offline edits, reconnect, push, pull, and acknowledgement preserve exact counts", () => {
  let state = initialScheduleSyncState;
  state = reduceScheduleSyncState(state, {
    type: "AUTH_CHANGED",
    accountId: accountA,
    pending: 2,
    conflicts: 0,
  });
  state = reduceScheduleSyncState(state, { type: "OFFLINE" });
  assert.deepEqual(scheduleSyncStatus(state), { kind: "offline", pending: 2 });
  state = reduceScheduleSyncState(state, { type: "ONLINE" });
  assert.deepEqual(scheduleSyncStatus(state), { kind: "pending", pending: 2 });
  state = reduceScheduleSyncState(state, {
    type: "PUSH_STARTED",
    ...runContext(state),
  });
  assert.deepEqual(scheduleSyncStatus(state), { kind: "syncing", pending: 2 });
  state = reduceScheduleSyncState(state, {
    type: "PUSH_ACKNOWLEDGED",
    ...runContext(state),
    pending: 1,
    lastSyncedAt: "2026-01-01T00:00:00.000Z",
  });
  state = reduceScheduleSyncState(state, {
    type: "PULL_APPLIED",
    ...runContext(state),
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
    type: "PUSH_STARTED",
    ...runContext(state),
  });
  state = reduceScheduleSyncState(state, {
    type: "PUSH_ACKNOWLEDGED",
    ...runContext(state),
    pending: 0,
    lastSyncedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.deepEqual(scheduleSyncStatus(state), {
    kind: "needs-review",
    conflicts: 1,
  });
  state = reduceScheduleSyncState(state, {
    type: "CONFLICT",
    ...runContext(state),
    conflicts: 0,
  });
  assert.deepEqual(scheduleSyncStatus(state), {
    kind: "saved",
    lastSyncedAt: "2026-01-01T00:00:00.000Z",
  });
});

test("auth expiry and offline precedence retain pending and conflict counts", () => {
  let state = reduceScheduleSyncState(initialScheduleSyncState, {
    type: "AUTH_CHANGED",
    accountId: accountA,
    pending: 4,
    conflicts: 2,
  });
  const activeRun = runContext(state);
  state = reduceScheduleSyncState(state, {
    type: "PUSH_STARTED",
    ...activeRun,
  });
  state = reduceScheduleSyncState(state, { type: "OFFLINE" });
  assert.deepEqual(scheduleSyncStatus(state), { kind: "offline", pending: 4 });
  state = reduceScheduleSyncState(state, {
    type: "AUTH_EXPIRED",
    ...activeRun,
  });
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
  state = reduceScheduleSyncState(state, {
    type: "PUSH_STARTED",
    ...runContext(state),
  });
  state = reduceScheduleSyncState(state, {
    type: "FAILED",
    ...runContext(state),
  });
  assert.deepEqual(scheduleSyncStatus(state), {
    kind: "error",
    message: "Schedule sync failed. Try again.",
    pending: 1,
  });
  state = reduceScheduleSyncState(state, {
    type: "PUSH_STARTED",
    ...runContext(state, 2),
  });
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

test("switching from saved account A to never-synced account B clears lastSyncedAt", () => {
  let state = reduceScheduleSyncState(initialScheduleSyncState, {
    type: "AUTH_CHANGED",
    accountId: accountA,
    pending: 0,
    conflicts: 0,
    lastSyncedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(scheduleSyncStatus(state).kind, "saved");
  state = reduceScheduleSyncState(state, {
    type: "AUTH_CHANGED",
    accountId: accountB,
    pending: 0,
    conflicts: 0,
  });
  assert.equal(Object.hasOwn(state, "lastSyncedAt"), false);
  assert.deepEqual(scheduleSyncStatus(state), { kind: "pending", pending: 0 });
});

test("negative or non-integer counts are rejected", () => {
  assert.throws(
    () =>
      reduceScheduleSyncState(initialScheduleSyncState, {
        type: "AUTH_CHANGED",
        accountId: accountA,
        pending: -1,
        conflicts: 0,
      }),
    /count/i,
  );
  let state = reduceScheduleSyncState(initialScheduleSyncState, {
    type: "AUTH_CHANGED",
    accountId: accountA,
    pending: 0,
    conflicts: 0,
  });
  state = reduceScheduleSyncState(state, {
    type: "PUSH_STARTED",
    ...runContext(state),
  });
  assert.throws(() => {
    reduceScheduleSyncState(state, {
      type: "CONFLICT",
      ...runContext(state),
      conflicts: 1.5,
    });
  }, /count/i);
});

test("late account A async events cannot mutate account B state", () => {
  let state = reduceScheduleSyncState(initialScheduleSyncState, {
    type: "AUTH_CHANGED",
    accountId: accountA,
    pending: 2,
    conflicts: 0,
  });
  const accountAGeneration = state.generation;
  state = reduceScheduleSyncState(state, {
    type: "PUSH_STARTED",
    accountId: accountA,
    generation: accountAGeneration,
    runToken: 1,
  });
  state = reduceScheduleSyncState(state, {
    type: "AUTH_CHANGED",
    accountId: accountB,
    pending: 1,
    conflicts: 0,
  });
  const accountBState = state;
  const lateEvents = [
    {
      type: "PUSH_ACKNOWLEDGED" as const,
      accountId: accountA,
      generation: accountAGeneration,
      runToken: 1,
      pending: 0,
      lastSyncedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      type: "PULL_APPLIED" as const,
      accountId: accountA,
      generation: accountAGeneration,
      runToken: 1,
      pending: 0,
      conflicts: 0,
      lastSyncedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      type: "CONFLICT" as const,
      accountId: accountA,
      generation: accountAGeneration,
      runToken: 1,
      conflicts: 3,
    },
    {
      type: "FAILED" as const,
      accountId: accountA,
      generation: accountAGeneration,
      runToken: 1,
    },
  ];
  for (const event of lateEvents) {
    assert.deepEqual(reduceScheduleSyncState(state, event), accountBState);
  }
});

test("an explicit hook generation remains aligned after an initialization retry", () => {
  const accountId = "33333333-3333-4333-8333-333333333333";
  const initialized = reduceScheduleSyncState(initialScheduleSyncState, {
    type: "AUTH_CHANGED",
    accountId,
    pending: 2,
    conflicts: 1,
    generation: 7,
  });
  assert.equal(initialized.generation, 7);
  const syncing = reduceScheduleSyncState(initialized, {
    type: "PUSH_STARTED",
    accountId,
    generation: 7,
    runToken: 1,
  });
  assert.equal(syncing.pushing, true);
  assert.equal(syncing.pending, 2);
  assert.equal(syncing.conflicts, 1);
});

test("AUTH_EXPIRED ignores a late account A run and accepts the active account B run", () => {
  let state = reduceScheduleSyncState(initialScheduleSyncState, {
    type: "AUTH_CHANGED",
    accountId: accountA,
    pending: 2,
    conflicts: 0,
  });
  const accountARun = runContext(state);
  state = reduceScheduleSyncState(state, {
    type: "PUSH_STARTED",
    ...accountARun,
  });
  state = reduceScheduleSyncState(state, {
    type: "AUTH_CHANGED",
    accountId: accountB,
    pending: 1,
    conflicts: 0,
  });
  state = reduceScheduleSyncState(state, {
    type: "PUSH_STARTED",
    ...runContext(state),
  });
  const accountBRunState = state;
  state = reduceScheduleSyncState(state, {
    type: "AUTH_EXPIRED",
    ...accountARun,
  });
  assert.deepEqual(state, accountBRunState);
  state = reduceScheduleSyncState(state, {
    type: "AUTH_EXPIRED",
    ...runContext(state),
  });
  assert.deepEqual(scheduleSyncStatus(state), {
    kind: "auth-required",
    pending: 1,
  });
});

test("OFFLINE is global connectivity state and cannot carry a late account pending count", () => {
  let state = reduceScheduleSyncState(initialScheduleSyncState, {
    type: "AUTH_CHANGED",
    accountId: accountA,
    pending: 4,
    conflicts: 0,
  });
  const accountARun = runContext(state);
  state = reduceScheduleSyncState(state, {
    type: "PUSH_STARTED",
    ...accountARun,
  });
  state = reduceScheduleSyncState(state, {
    type: "AUTH_CHANGED",
    accountId: accountB,
    pending: 1,
    conflicts: 0,
  });
  state = reduceScheduleSyncState(
    state,
    {
      type: "OFFLINE",
      pending: 4,
      ...accountARun,
    } as unknown as ScheduleSyncEvent,
  );
  assert.equal(state.pending, 1);
  assert.deepEqual(scheduleSyncStatus(state), { kind: "offline", pending: 1 });
});
