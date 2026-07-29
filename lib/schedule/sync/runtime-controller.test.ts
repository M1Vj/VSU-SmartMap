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
