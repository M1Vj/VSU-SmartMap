import assert from "node:assert/strict";
import test from "node:test";
import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { VSUDatabase } from "../../db";
import { removeLocalScheduleAccountData } from "../account-local-data";
import { createDexieScopedScheduleStore, ScheduleRepository } from "../repository";
import { accountScheduleScope } from "../scope";
import type { ScheduleCourse } from "../types";
import type { ScheduleCloudGateway } from "./cloud-gateway";
import { ScheduleSyncCoordinator } from "./coordinator";
import { createDexieScheduleSyncLocalStore } from "./dexie-sync-store";
import { createScheduleSyncRuntimeController } from "./runtime-controller";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const scope = accountScheduleScope("33333333-3333-4333-8333-333333333333");
const otherScope = accountScheduleScope("44444444-4444-4444-8444-444444444444");
const firstId = "11111111-1111-4111-8111-111111111111";
const restoredId = "22222222-2222-4222-8222-222222222222";

function course(id: string, title: string): ScheduleCourse {
  return {
    id, code: "TEST", title, color: "blue",
    meetings: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", days: [1], startMinute: 480, endMinute: 540 }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("offline repository changes coalesce, restore, and replay after reconnect without crossing accounts", async () => {
  const database = new VSUDatabase();
  const store = createDexieScopedScheduleStore(database);
  let requests = 0;
  let mutationCounter = 0;
  const repository = new ScheduleRepository(
    scope,
    () => store,
    {
      mutationId: () => `55555555-5555-4555-8555-${(++mutationCounter).toString().padStart(12, "0")}`,
      now: () => new Date("2026-02-01T00:00:00.000Z"),
    },
    () => { requests += 1; },
  );
  await repository.put(course(firstId, "Created"));
  await repository.put(course(firstId, "Edited"));
  await repository.remove(firstId);
  assert.equal(await database.schedule_outbox.where("scope").equals(scope).count(), 0);
  await repository.replaceAll([course(restoredId, "Restored")]);
  assert.equal(requests, 4);
  assert.equal(await database.schedule_outbox.where("scope").equals(scope).count(), 1);

  let online = false;
  const cloud = new Map<string, ScheduleCourse>();
  const gateway: ScheduleCloudGateway = {
    async push(mutation) {
      assert.equal(mutation.scope, scope);
      if (mutation.operation === "upsert" && mutation.course) {
        cloud.set(mutation.courseId, mutation.course);
        return {
          kind: "accepted", status: "upserted",
          row: {
            id: mutation.courseId, payload: mutation.course, revision: 1, serverVersion: 1,
            createdAt: mutation.createdAt, updatedAt: mutation.createdAt,
          },
        };
      }
      return { kind: "deleted-noop", courseId: mutation.courseId, revision: 0 };
    },
    async pull() { return []; },
  };
  const localSyncStore = createDexieScheduleSyncLocalStore(database, {
    mutationId: () => "66666666-6666-4666-8666-666666666666",
    now: () => new Date("2026-02-01T00:00:00.000Z"),
  });
  const coordinator = new ScheduleSyncCoordinator({
    store: localSyncStore,
    gateway,
    online: () => online,
  });
  assert.equal((await coordinator.sync(scope)).kind, "offline");
  assert.equal(cloud.size, 0);
  online = true;
  assert.equal((await coordinator.sync(scope)).kind, "synced");
  assert.deepEqual([...cloud.keys()], [restoredId]);
  assert.equal(await localSyncStore.pendingCount(scope), 0);
  assert.equal(await database.schedule_outbox.where("scope").equals(otherScope).count(), 0);
  await database.delete();
});

async function assertScopeEmpty(database: VSUDatabase) {
  assert.equal(await database.schedule_scoped_courses.where("scope").equals(scope).count(), 0);
  assert.equal(await database.schedule_outbox.where("scope").equals(scope).count(), 0);
  assert.equal(await database.schedule_conflicts.where("scope").equals(scope).count(), 0);
  assert.equal(await database.schedule_sync_state.get(scope), undefined);
}

test("local account removal drains accepted push acknowledgement before atomic clear", async () => {
  const database = new VSUDatabase();
  const repository = new ScheduleRepository(
    scope,
    () => createDexieScopedScheduleStore(database),
    {
      mutationId: () => "77777777-7777-4777-8777-777777777777",
      now: () => new Date("2026-02-01T00:00:00.000Z"),
    },
  );
  await repository.put(course(firstId, "In flight"));
  await database.schedule_sync_state.put({
    scope, consentEnabled: true, reconciliationCompleted: true,
  });
  let release!: () => void;
  let started!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const pushStarted = new Promise<void>((resolve) => { started = resolve; });
  const cloud = new Map<string, ScheduleCourse>();
  let clientAborted = false;
  let serverCompleted = false;
  let cleared = false;
  const localStore = createDexieScheduleSyncLocalStore(database, {
    mutationId: () => "88888888-8888-4888-8888-888888888888",
    now: () => new Date("2026-02-02T00:00:00.000Z"),
  });
  const runtime = createScheduleSyncRuntimeController({
    scope,
    enabled: true, authenticated: true, offlineVerified: true, consent: true, reconciled: true,
    createCoordinator: () => new ScheduleSyncCoordinator({
      store: localStore,
      gateway: {
        async push(mutation, signal) {
          started();
          await Promise.race([
            blocked.then(() => {
              if (mutation.course) cloud.set(mutation.courseId, mutation.course);
              serverCompleted = true;
            }),
            new Promise<never>((_, reject) => signal?.addEventListener("abort", () => {
              clientAborted = true;
              reject(new DOMException("aborted", "AbortError"));
            }, { once: true })),
          ]);
          return {
            kind: "accepted", status: "upserted",
            row: {
              id: mutation.courseId, payload: mutation.course!, revision: 1, serverVersion: 1,
              createdAt: mutation.createdAt, updatedAt: mutation.createdAt,
            },
          };
        },
        async pull() { return []; },
      },
    }),
  });
  runtime.start();
  await pushStarted;
  const draining = runtime.stopAndDrain();
  await Promise.resolve();
  assert.equal(clientAborted, false);
  assert.equal(serverCompleted, false);
  release();
  await draining;
  await removeLocalScheduleAccountData(database, scope);
  cleared = true;
  await assertScopeEmpty(database);
  assert.equal(serverCompleted, true);
  assert.equal(clientAborted, false);
  assert.equal(cleared, true);
  assert.deepEqual([...cloud.keys()], [firstId]);
  await database.delete();
});

test("local account removal drains pull application before atomic clear", async () => {
  const database = new VSUDatabase();
  await database.schedule_sync_state.put({
    scope, consentEnabled: true, reconciliationCompleted: true,
  });
  let release!: () => void;
  let started!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const pullStarted = new Promise<void>((resolve) => { started = resolve; });
  const localStore = createDexieScheduleSyncLocalStore(database);
  const runtime = createScheduleSyncRuntimeController({
    scope,
    enabled: true, authenticated: true, offlineVerified: true, consent: true, reconciled: true,
    createCoordinator: () => new ScheduleSyncCoordinator({
      store: localStore,
      gateway: {
        async push() { throw new Error("unexpected push"); },
        async pull() {
          started();
          await blocked;
          return [{
            id: restoredId, payload: course(restoredId, "Pulled"), revision: 1, serverVersion: 1,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          }];
        },
      },
    }),
  });
  runtime.start();
  await pullStarted;
  const draining = runtime.stopAndDrain();
  release();
  await draining;
  await removeLocalScheduleAccountData(database, scope);
  await assertScopeEmpty(database);
  await database.delete();
});

test("timed-out local account removal leaves courses and consent intact", async () => {
  const database = new VSUDatabase();
  const repository = new ScheduleRepository(
    scope,
    () => createDexieScopedScheduleStore(database),
  );
  await repository.put(course(firstId, "Keep on timeout"));
  await database.schedule_sync_state.put({
    scope, consentEnabled: true, reconciliationCompleted: true,
  });
  let started!: () => void;
  const pushStarted = new Promise<void>((resolve) => { started = resolve; });
  const runtime = createScheduleSyncRuntimeController({
    scope,
    enabled: true, authenticated: true, offlineVerified: true, consent: true, reconciled: true,
    drainTimeoutMs: 5,
    createCoordinator: () => new ScheduleSyncCoordinator({
      store: createDexieScheduleSyncLocalStore(database),
      gateway: {
        async push() {
          started();
          return new Promise<never>(() => undefined);
        },
        async pull() { return []; },
      },
    }),
  });
  runtime.start();
  await pushStarted;
  await assert.rejects(runtime.stopAndDrain(), /timed out/i);
  assert.equal(await database.schedule_scoped_courses.where("scope").equals(scope).count(), 1);
  assert.equal(await database.schedule_outbox.where("scope").equals(scope).count(), 1);
  assert.equal((await database.schedule_sync_state.get(scope))?.consentEnabled, true);
  await database.delete();
});
