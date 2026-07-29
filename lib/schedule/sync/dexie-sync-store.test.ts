import assert from "node:assert/strict";
import test from "node:test";
import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { VSUDatabase } from "../../db";
import { scopedCourseKey } from "../local-types";
import { createDexieScopedScheduleStore, ScheduleRepository } from "../repository";
import { accountScheduleScope } from "../scope";
import type { ScheduleCourse } from "../types";
import { createDexieScheduleSyncLocalStore, resolveDexieScheduleReview } from "./dexie-sync-store";
import { resolvePulledRow } from "./reconcile";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const scope = accountScheduleScope("33333333-3333-4333-8333-333333333333");
const id = "11111111-1111-4111-8111-111111111111";
const mutationId = "22222222-2222-4222-8222-222222222222";

function course(title: string): ScheduleCourse {
  return {
    id, code: "TEST", title, color: "blue",
    meetings: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", days: [1], startMinute: 480, endMinute: 540 }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("acknowledge rebases a newer local mutation without replacing its payload", async () => {
  const database = new VSUDatabase();
  const sent = {
    scope, courseId: id, mutationId, expectedRevision: 0,
    operation: "upsert" as const, course: course("Sent"),
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  await database.schedule_scoped_courses.put({
    key: scopedCourseKey(scope, id), scope, id, course: course("Newer"),
  });
  await database.schedule_outbox.add({
    ...sent,
    mutationId: "44444444-4444-4444-8444-444444444444",
    course: course("Newer"),
  });
  await createDexieScheduleSyncLocalStore(database).acknowledge(scope, sent, {
    kind: "accepted",
    status: "upserted",
    row: {
      id, payload: course("Sent"), revision: 7, serverVersion: 7,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  });
  assert.equal((await database.schedule_scoped_courses.get(scopedCourseKey(scope, id)))?.course.title, "Newer");
  const pending = await database.schedule_outbox.where("[scope+courseId]").equals([scope, id]).first();
  assert.equal(pending?.course?.title, "Newer");
  assert.equal(pending?.expectedRevision, 7);
  await database.delete();
});

test("applyPull quarantines invalid payload metadata and advances cursor atomically", async () => {
  const database = new VSUDatabase();
  const store = createDexieScheduleSyncLocalStore(database);
  const result = await store.applyPull(scope, [{
    id, payload: { title: "private malformed payload" }, revision: 2, serverVersion: 9,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }], 9, resolvePulledRow);
  assert.deepEqual(result, { conflicts: 0, quarantined: 1 });
  assert.equal(await store.cursorFor(scope), 9);
  assert.equal(await database.schedule_scoped_courses.where("scope").equals(scope).count(), 0);
  assert.equal((await store.reviewCounts(scope)).quarantined, 1);
  await database.delete();
});

test("applyPull rolls back rows and cursor when the course limit would be exceeded", async () => {
  const database = new VSUDatabase();
  const store = createDexieScheduleSyncLocalStore(database);
  await database.schedule_sync_state.put({ scope, cursor: 3 });
  const rows = Array.from({ length: 201 }, (_, index) => {
    const suffix = index.toString(16).padStart(12, "0");
    const courseId = `00000000-0000-4000-8000-${suffix}`;
    return {
      id: courseId,
      payload: { ...course("Remote"), id: courseId },
      revision: 1, serverVersion: index + 4,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  });
  await assert.rejects(store.applyPull(scope, rows, 204, resolvePulledRow));
  assert.equal(await store.cursorFor(scope), 3);
  assert.equal(await database.schedule_scoped_courses.where("scope").equals(scope).count(), 0);
  await database.delete();
});

test("ongoing local conflict resolution clears review and queues one rebased upsert", async () => {
  const database = new VSUDatabase();
  await database.schedule_conflicts.put({
    key: scopedCourseKey(scope, id), scope, courseId: id,
    local: course("Chosen local"), remote: course("Remote"), serverRevision: 8,
    reviewKind: "conflict",
  });
  await resolveDexieScheduleReview(database, scope, scopedCourseKey(scope, id), "local", {
    mutationId: () => "55555555-5555-4555-8555-555555555555",
    now: () => new Date("2026-02-01T00:00:00.000Z"),
  });
  assert.equal(await database.schedule_conflicts.count(), 0);
  const mutation = await database.schedule_outbox.where("scope").equals(scope).first();
  assert.equal(mutation?.expectedRevision, 8);
  assert.equal(mutation?.course?.title, "Chosen local");
  await database.delete();
});

test("push conflict pauses the mutation while later pull preserves local review data", async () => {
  const database = new VSUDatabase();
  const laterId = "99999999-9999-4999-8999-999999999999";
  const local = course("Unsynced local");
  const mutation = {
    scope, courseId: id, mutationId, expectedRevision: 2,
    operation: "upsert" as const, course: local,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  await database.schedule_scoped_courses.put({
    key: scopedCourseKey(scope, id), scope, id, course: local, serverRevision: 2,
  });
  await database.schedule_outbox.add(mutation);
  await database.schedule_outbox.add({
    ...mutation,
    sequence: undefined,
    courseId: laterId,
    mutationId: "88888888-8888-4888-8888-888888888888",
    course: { ...local, id: laterId, title: "Later course" },
  });
  const store = createDexieScheduleSyncLocalStore(database);
  await store.recordPushConflict(scope, mutation, {
    kind: "conflict", courseId: id, remote: {
      id, payload: course("Remote"), revision: 3, serverVersion: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  });
  await store.applyPull(scope, [{
    id, payload: course("Remote"), revision: 3, serverVersion: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }], 3, resolvePulledRow);
  assert.equal(await store.pendingCount(scope), 1);
  assert.deepEqual(
    (await store.listOutbox(scope)).map(({ courseId }) => courseId),
    [laterId],
  );
  assert.equal((await database.schedule_scoped_courses.get(scopedCourseKey(scope, id)))?.course.title, "Unsynced local");
  assert.equal((await store.reviewCounts(scope)).conflicts, 1);
  assert.equal(
    (await database.schedule_conflicts.get(scopedCourseKey(scope, id)))?.remote?.title,
    "Remote",
  );
  await database.delete();
});

test("stale pull cannot regress an advanced cursor or apply its rows", async () => {
  const database = new VSUDatabase();
  await database.schedule_sync_state.put({ scope, cursor: 10 });
  const store = createDexieScheduleSyncLocalStore(database);
  await assert.rejects(store.applyPull(scope, [{
    id, payload: course("Stale"), revision: 1, serverVersion: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }], 5, resolvePulledRow), /stale/i);
  assert.equal(await store.cursorFor(scope), 10);
  assert.equal(await database.schedule_scoped_courses.get(scopedCourseKey(scope, id)), undefined);
  await database.delete();
});

test("a repaired valid row clears its prior quarantine metadata", async () => {
  const database = new VSUDatabase();
  const store = createDexieScheduleSyncLocalStore(database);
  await store.applyPull(scope, [{
    id, payload: { malformed: true }, revision: 1, serverVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }], 1, resolvePulledRow);
  await store.applyPull(scope, [{
    id, payload: course("Repaired"), revision: 2, serverVersion: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }], 2, resolvePulledRow);
  assert.deepEqual(await store.reviewCounts(scope), { conflicts: 0, quarantined: 0 });
  await database.delete();
});

test("choosing local after a repository edit keeps the newer canonical edit", async () => {
  const database = new VSUDatabase();
  await database.schedule_scoped_courses.put({
    key: scopedCourseKey(scope, id), scope, id,
    course: course("Old local"), serverRevision: 2,
  });
  await database.schedule_conflicts.put({
    key: scopedCourseKey(scope, id), scope, courseId: id,
    local: course("Old local"), remote: course("Remote V2"),
    serverRevision: 2, reviewKind: "conflict",
  });
  const repository = new ScheduleRepository(
    scope,
    () => createDexieScopedScheduleStore(database),
    {
      mutationId: () => "77777777-7777-4777-8777-777777777777",
      now: () => new Date("2026-02-01T00:00:00.000Z"),
    },
  );
  await repository.put(course("Newer local edit"));
  await resolveDexieScheduleReview(
    database,
    scope,
    scopedCourseKey(scope, id),
    "local",
    {
      mutationId: () => "88888888-8888-4888-8888-888888888888",
      now: () => new Date("2026-02-02T00:00:00.000Z"),
    },
  );
  const row = await database.schedule_scoped_courses.get(scopedCourseKey(scope, id));
  const pending = await database.schedule_outbox.where("scope").equals(scope).first();
  assert.equal(row?.course.title, "Newer local edit");
  assert.equal(pending?.course?.title, "Newer local edit");
  assert.equal(pending?.expectedRevision, 2);
  await database.delete();
});

test("choosing remote uses the latest cloud row observed while review is open", async () => {
  const database = new VSUDatabase();
  await database.schedule_scoped_courses.put({
    key: scopedCourseKey(scope, id), scope, id,
    course: course("Local"), serverRevision: 1,
  });
  await database.schedule_conflicts.put({
    key: scopedCourseKey(scope, id), scope, courseId: id,
    local: course("Local"), remote: course("Remote V2"),
    serverRevision: 2, reviewKind: "conflict",
  });
  const store = createDexieScheduleSyncLocalStore(database);
  await store.applyPull(scope, [{
    id, payload: course("Remote V3"), revision: 3, serverVersion: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  }], 3, resolvePulledRow);
  await resolveDexieScheduleReview(
    database,
    scope,
    scopedCourseKey(scope, id),
    "remote",
  );
  const row = await database.schedule_scoped_courses.get(scopedCourseKey(scope, id));
  assert.equal(row?.course.title, "Remote V3");
  assert.equal(row?.serverRevision, 3);
  assert.equal(await store.cursorFor(scope), 3);
  assert.equal(await database.schedule_outbox.where("scope").equals(scope).count(), 0);
  await database.delete();
});

test("poison pull cannot replace an existing valid conflict snapshot", async () => {
  for (const payload of [
    { ...course("Wrong identity"), id: "99999999-9999-4999-8999-999999999999" },
    { ...course("Invalid semantics"), meetings: [] },
  ]) {
    const database = new VSUDatabase();
    await database.schedule_scoped_courses.put({
      key: scopedCourseKey(scope, id), scope, id,
      course: course("Local"), serverRevision: 1,
    });
    await database.schedule_conflicts.put({
      key: scopedCourseKey(scope, id), scope, courseId: id,
      local: course("Local"), remote: course("Valid remote V2"),
      serverRevision: 2, reviewKind: "conflict",
    });
    const store = createDexieScheduleSyncLocalStore(database);
    await store.applyPull(scope, [{
      id, payload, revision: 3, serverVersion: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    }], 3, resolvePulledRow);
    const review = await database.schedule_conflicts.get(scopedCourseKey(scope, id));
    assert.equal(review?.remote?.title, "Valid remote V2");
    assert.equal(review?.serverRevision, 2);
    assert.equal((await store.reviewCounts(scope)).quarantined, 1);
    assert.equal(
      (await database.schedule_scoped_courses.get(scopedCourseKey(scope, id)))?.course.title,
      "Local",
    );
    await resolveDexieScheduleReview(
      database,
      scope,
      scopedCourseKey(scope, id),
      "remote",
    );
    const selected = await database.schedule_scoped_courses.get(scopedCourseKey(scope, id));
    assert.equal(selected?.id, id);
    assert.equal(selected?.course.id, id);
    assert.equal(selected?.course.title, "Valid remote V2");
    await database.delete();
  }
});

test("review resolution permits the 200th active course but atomically rejects the 201st", async () => {
  for (const existingCount of [199, 200]) {
    const database = new VSUDatabase();
    const rows = Array.from({ length: existingCount }, (_, index) => {
      const courseId = `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
      return {
        key: scopedCourseKey(scope, courseId),
        scope,
        id: courseId,
        course: { ...course("Existing"), id: courseId },
      };
    });
    await database.schedule_scoped_courses.bulkAdd(rows);
    await database.schedule_conflicts.put({
      key: scopedCourseKey(scope, id), scope, courseId: id,
      remote: course("Reviewed remote"), serverRevision: 4,
      reviewKind: "conflict",
    });
    const resolution = resolveDexieScheduleReview(
      database,
      scope,
      scopedCourseKey(scope, id),
      "remote",
    );
    if (existingCount === 199) {
      await resolution;
      assert.equal(
        await database.schedule_scoped_courses.where("scope").equals(scope).count(),
        200,
      );
      assert.equal(await database.schedule_conflicts.count(), 0);
    } else {
      await assert.rejects(resolution, /course limit/i);
      assert.equal(
        await database.schedule_scoped_courses.where("scope").equals(scope).count(),
        200,
      );
      assert.equal(await database.schedule_conflicts.count(), 1);
      assert.equal(
        await database.schedule_scoped_courses.get(scopedCourseKey(scope, id)),
        undefined,
      );
    }
    await database.delete();
  }
});
