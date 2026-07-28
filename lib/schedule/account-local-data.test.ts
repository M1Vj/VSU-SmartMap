import assert from "node:assert/strict";
import test from "node:test";
import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";

import { VSUDatabase } from "../db";
import { removeLocalScheduleAccountData } from "./account-local-data";
import { scopedCourseKey } from "./local-types";
import { accountScheduleScope, GUEST_SCHEDULE_SCOPE } from "./scope";
import type { ScheduleCourse } from "./types";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const course = (id: string): ScheduleCourse => ({
  id,
  code: "TEST",
  title: "Private",
  color: "blue",
  meetings: [],
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
});

test("removal atomically clears only the selected account scope", async () => {
  const database = new VSUDatabase();
  const accountA = accountScheduleScope("00000000-0000-4000-8000-000000000001");
  const accountB = accountScheduleScope("00000000-0000-4000-8000-000000000002");
  const aId = "00000000-0000-4000-8000-000000000011";
  const bId = "00000000-0000-4000-8000-000000000012";
  const guestId = "00000000-0000-4000-8000-000000000013";

  await database.schedule_scoped_courses.bulkAdd([
    { key: scopedCourseKey(accountA, aId), scope: accountA, id: aId, course: course(aId) },
    { key: scopedCourseKey(accountB, bId), scope: accountB, id: bId, course: course(bId) },
    { key: scopedCourseKey(GUEST_SCHEDULE_SCOPE, guestId), scope: GUEST_SCHEDULE_SCOPE, id: guestId, course: course(guestId) },
  ]);
  await database.schedule_outbox.add({
    scope: accountA, courseId: aId, mutationId: aId, expectedRevision: 0,
    operation: "upsert", course: course(aId), createdAt: "2026-07-01T00:00:00.000Z",
  });
  await database.schedule_sync_state.bulkAdd([
    { scope: accountA, consentEnabled: true },
    { scope: accountB, consentEnabled: true },
  ]);
  await database.schedule_conflicts.add({
    key: scopedCourseKey(accountA, aId), scope: accountA, courseId: aId,
    local: course(aId), serverRevision: 1,
  });

  await removeLocalScheduleAccountData(database, accountA);

  assert.equal(await database.schedule_scoped_courses.where("scope").equals(accountA).count(), 0);
  assert.equal(await database.schedule_outbox.where("scope").equals(accountA).count(), 0);
  assert.equal(await database.schedule_conflicts.where("scope").equals(accountA).count(), 0);
  assert.equal(await database.schedule_sync_state.get(accountA), undefined);
  assert.equal(await database.schedule_scoped_courses.where("scope").equals(accountB).count(), 1);
  assert.equal(await database.schedule_scoped_courses.where("scope").equals(GUEST_SCHEDULE_SCOPE).count(), 1);
  assert.equal((await database.schedule_sync_state.get(accountB))?.consentEnabled, true);
  database.close();
});
