import assert from "node:assert/strict";
import test from "node:test";
import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { VSUDatabase } from "../../db";
import { createDexieScopedScheduleStore, ScheduleRepository } from "../repository";
import { accountScheduleScope } from "../scope";
import type { ScheduleCourse } from "../types";
import type { ScheduleCloudGateway } from "./cloud-gateway";
import { ScheduleSyncCoordinator } from "./coordinator";
import { createDexieScheduleSyncLocalStore } from "./dexie-sync-store";

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
