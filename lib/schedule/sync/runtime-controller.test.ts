import assert from "node:assert/strict";
import test from "node:test";
import { createScheduleSyncRuntimeController } from "./runtime-controller";

test("runtime gates prevent coordinator construction", () => {
  let constructions = 0;
  for (const gate of [
    { enabled: false, authenticated: true, offlineVerified: true, consent: true, reconciled: true },
    { enabled: true, authenticated: false, offlineVerified: true, consent: true, reconciled: true },
    { enabled: true, authenticated: true, offlineVerified: false, consent: true, reconciled: true },
    { enabled: true, authenticated: true, offlineVerified: true, consent: false, reconciled: true },
    { enabled: true, authenticated: true, offlineVerified: true, consent: true, reconciled: false },
  ]) {
    const runtime = createScheduleSyncRuntimeController({
      scope: "user:33333333-3333-4333-8333-333333333333",
      ...gate,
      createCoordinator: () => {
        constructions += 1;
        return { sync: async () => ({ kind: "skipped" as const, scope: "guest" as const }) };
      },
      debounceMs: 5,
    });
    runtime.start();
    runtime.requestSync();
    runtime.dispose();
  }
  assert.equal(constructions, 0);
});

test("mutation requests are debounced and disposal cancels pending work", async () => {
  let syncs = 0;
  const runtime = createScheduleSyncRuntimeController({
    scope: "user:33333333-3333-4333-8333-333333333333",
    enabled: true, authenticated: true, offlineVerified: true, consent: true, reconciled: true,
    createCoordinator: () => ({
      sync: async (scope) => {
        syncs += 1;
        return { kind: "synced" as const, scope, runToken: syncs, pending: 0, conflicts: 0 };
      },
    }),
    debounceMs: 5,
  });
  runtime.requestSync();
  runtime.requestSync();
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(syncs, 1);
  runtime.requestSync();
  runtime.dispose();
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(syncs, 1);
});

test("offline events publish offline immediately and reconnect runs sync", async () => {
  const listeners = new Map<string, () => void>();
  const states: boolean[] = [];
  let syncs = 0;
  const runtime = createScheduleSyncRuntimeController({
    scope: "user:33333333-3333-4333-8333-333333333333",
    enabled: true, authenticated: true, offlineVerified: true, consent: true, reconciled: true,
    createCoordinator: () => ({
      sync: async (scope) => {
        syncs += 1;
        return { kind: "offline" as const, scope };
      },
    }),
    onOnlineChanged: (online) => states.push(online),
    eventTarget: {
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject) =>
        listeners.set(type, listener as () => void),
      removeEventListener: (type: string) => { listeners.delete(type); },
    },
  });
  runtime.start();
  await Promise.resolve();
  assert.deepEqual(states, [false]);
  listeners.get("offline")?.();
  assert.deepEqual(states, [false, false]);
  listeners.get("online")?.();
  await Promise.resolve();
  assert.equal(syncs, 2);
  runtime.dispose();
  assert.equal(listeners.size, 0);
});

test("synchronous coordinator construction failure is recoverable and leaves no listeners", () => {
  const listeners = new Map<string, EventListenerOrEventListenerObject>();
  let failures = 0;
  const runtime = createScheduleSyncRuntimeController({
    scope: "user:33333333-3333-4333-8333-333333333333",
    enabled: true, authenticated: true, offlineVerified: true, consent: true, reconciled: true,
    createCoordinator: () => { throw new Error("private provider detail"); },
    onSynchronousError: () => { failures += 1; },
    eventTarget: {
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.set(type, listener);
      },
      removeEventListener: (type: string) => { listeners.delete(type); },
    },
  });
  assert.equal(runtime.start(), false);
  runtime.dispose();
  assert.equal(failures, 1);
  assert.equal(listeners.size, 0);
});

test("stopAndDrain quiesces without cancelling and waits for the active scoped sync", async () => {
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  let settled = false;
  let cancellations = 0;
  const runtime = createScheduleSyncRuntimeController({
    scope: "user:33333333-3333-4333-8333-333333333333",
    enabled: true, authenticated: true, offlineVerified: true, consent: true, reconciled: true,
    createCoordinator: () => ({
      async sync(scope) {
        await blocked;
        settled = true;
        return { kind: "synced" as const, scope, runToken: 1, pending: 0, conflicts: 0 };
      },
      cancel() { cancellations += 1; },
    }),
  });
  assert.equal(runtime.start(), true);
  const draining = runtime.stopAndDrain();
  await Promise.resolve();
  assert.equal(cancellations, 0);
  assert.equal(settled, false);
  release();
  await draining;
  assert.equal(settled, true);
});

test("stopAndDrain rejects on timeout instead of clearing through a hanging sync", async () => {
  const runtime = createScheduleSyncRuntimeController({
    scope: "user:33333333-3333-4333-8333-333333333333",
    enabled: true, authenticated: true, offlineVerified: true, consent: true, reconciled: true,
    createCoordinator: () => ({
      sync: async () => new Promise<never>(() => undefined),
      cancel() { throw new Error("destructive drain must not cancel"); },
    }),
    drainTimeoutMs: 5,
  });
  assert.equal(runtime.start(), true);
  await assert.rejects(runtime.stopAndDrain(), /timed out/i);
});
