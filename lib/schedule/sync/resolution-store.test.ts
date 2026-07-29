import assert from "node:assert/strict";
import test from "node:test";
import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { VSUDatabase } from "../../db";
import { scopedCourseKey } from "../local-types";
import { accountScheduleScope, GUEST_SCHEDULE_SCOPE } from "../scope";
import type { ScheduleCourse } from "../types";
import {
  buildCourseResolutionPlan,
  createValidatedScheduleReconciliationSnapshot,
} from "./resolution";
import { createDexieAtomicScheduleResolutionStore } from "./resolution-store";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const scope = accountScheduleScope("33333333-3333-4333-8333-333333333333");
const otherScope = accountScheduleScope("44444444-4444-4444-8444-444444444444");
const id = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";

function course(courseId: string, title: string): ScheduleCourse {
  return {
    id: courseId,
    code: "TEST",
    title,
    color: "blue",
    meetings: [{
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      days: [1],
      startMinute: 480,
      endMinute: 540,
    }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function plan() {
  const snapshot = createValidatedScheduleReconciliationSnapshot({
    guest: [course(id, "Guest chosen")],
    accountLocal: [{ course: course(id, "Old local"), serverRevision: 2 }],
    cloud: [{
      id,
      payload: course(id, "Cloud"),
      revision: 7,
      serverVersion: 7,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }],
  });
  const result = buildCourseResolutionPlan({
    scope,
    snapshot,
    resolution: { kind: "choose-source", courseId: id, source: "guest" },
  });
  assert.equal(result.kind, "ready");
  if (result.kind !== "ready") throw new Error("plan");
  return result.plan;
}

async function seededDatabase() {
  const database = new VSUDatabase();
  await database.schedule_scoped_courses.bulkAdd([
    { key: scopedCourseKey(scope, id), scope, id, course: course(id, "Old local"), serverRevision: 2 },
    { key: scopedCourseKey(otherScope, otherId), scope: otherScope, id: otherId, course: course(otherId, "Other") },
    { key: scopedCourseKey(GUEST_SCHEDULE_SCOPE, otherId), scope: GUEST_SCHEDULE_SCOPE, id: otherId, course: course(otherId, "Guest") },
  ]);
  await database.schedule_outbox.add({
    scope, courseId: id, mutationId: otherId, expectedRevision: 2,
    operation: "upsert", course: course(id, "Pending"), createdAt: "2026-01-01T00:00:00.000Z",
  });
  await database.schedule_conflicts.add({
    key: scopedCourseKey(scope, id), scope, courseId: id,
    local: course(id, "Old local"), remote: course(id, "Cloud"), serverRevision: 7,
  });
  await database.schedule_sync_state.put({ scope, consentEnabled: true });
  return database;
}

test("Dexie resolution atomically replaces same-course state with one fresh upsert", async () => {
  const database = await seededDatabase();
  const store = createDexieAtomicScheduleResolutionStore(database, {
    mutationId: () => "55555555-5555-4555-8555-555555555555",
    now: () => new Date("2026-02-01T00:00:00.000Z"),
  });
  await store.apply(plan());
  assert.equal((await database.schedule_scoped_courses.get(scopedCourseKey(scope, id)))?.course.title, "Guest chosen");
  const outbox = await database.schedule_outbox.where("scope").equals(scope).toArray();
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0]?.expectedRevision, 7);
  assert.equal(outbox[0]?.sequence !== undefined, true);
  assert.equal(await database.schedule_conflicts.where("scope").equals(scope).count(), 0);
  assert.equal((await database.schedule_sync_state.get(scope))?.reconciliationCompleted, true);
  assert.equal(await database.schedule_scoped_courses.where("scope").equals(otherScope).count(), 1);
  assert.equal(await database.schedule_scoped_courses.where("scope").equals(GUEST_SCHEDULE_SCOPE).count(), 1);
  await database.delete();
});

test("Dexie resolution rolls back all four stores when mutation creation fails", async () => {
  const database = await seededDatabase();
  const before = {
    rows: await database.schedule_scoped_courses.toArray(),
    outbox: await database.schedule_outbox.toArray(),
    conflicts: await database.schedule_conflicts.toArray(),
    state: await database.schedule_sync_state.toArray(),
  };
  const store = createDexieAtomicScheduleResolutionStore(database, {
    mutationId: () => {
      throw new Error("forced failure");
    },
    now: () => new Date("2026-02-01T00:00:00.000Z"),
  });
  await assert.rejects(store.apply(plan()), /forced failure/);
  assert.deepEqual(await database.schedule_scoped_courses.toArray(), before.rows);
  assert.deepEqual(await database.schedule_outbox.toArray(), before.outbox);
  assert.deepEqual(await database.schedule_conflicts.toArray(), before.conflicts);
  assert.deepEqual(await database.schedule_sync_state.toArray(), before.state);
  await database.delete();
});
