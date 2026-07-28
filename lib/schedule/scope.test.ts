import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";

import { VSUDatabase } from "../db.ts";
import {
  GUEST_SCHEDULE_SCOPE,
  accountScheduleScope,
} from "./scope.ts";
import type { ScheduleCourse } from "./types.ts";

const DATABASE_NAME = "VSUSmartMapDB";
Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const LEGACY_COURSE: ScheduleCourse = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  code: "CS 101",
  title: "Introduction to Computing",
  color: "blue",
  meetings: [
    {
      id: "123e4567-e89b-42d3-a456-426614174001",
      days: [1, 3],
      startMinute: 480,
      endMinute: 540,
    },
  ],
  createdAt: "2026-07-01T01:02:03.000Z",
  updatedAt: "2026-07-02T01:02:03.000Z",
};

async function deleteTestDatabase(): Promise<void> {
  await Dexie.delete(DATABASE_NAME);
}

async function seedLegacyDatabase(value: unknown): Promise<void> {
  const legacy = new Dexie(DATABASE_NAME);
  legacy.version(10).stores({
    schedule_courses: "id, code, updatedAt",
  });
  await legacy.open();
  await legacy.table("schedule_courses").put(value);
  legacy.close();
}

async function readLegacyCourses(): Promise<unknown[]> {
  const legacy = new Dexie(DATABASE_NAME);
  legacy.version(10).stores({
    schedule_courses: "id, code, updatedAt",
  });
  await legacy.open();
  try {
    const transaction = legacy
      .backendDB()
      .transaction("schedule_courses", "readonly");
    assert.equal(transaction.objectStore("schedule_courses").keyPath, "id");
    return await legacy.table("schedule_courses").toArray();
  } finally {
    legacy.close();
  }
}

test("builds stable guest and account scopes without accepting arbitrary text", () => {
  assert.equal(GUEST_SCHEDULE_SCOPE, "guest");
  assert.equal(
    accountScheduleScope("11111111-1111-4111-8111-111111111111"),
    "user:11111111-1111-4111-8111-111111111111",
  );
  assert.equal(
    accountScheduleScope("  11111111-1111-4111-8111-111111111111  "),
    "user:11111111-1111-4111-8111-111111111111",
  );
  assert.throws(() => accountScheduleScope("not-a-uuid"));
  assert.throws(() => accountScheduleScope("guest"));
});

test("database v11 declares only the exact new scoped stores", async () => {
  const source = await readFile(new URL("../db.ts", import.meta.url), "utf8");
  assert.match(source, /version\(11\)/);
  assert.match(
    source,
    /schedule_scoped_courses:\s*["']&key, scope, id, course\.updatedAt["']/,
  );
  assert.match(
    source,
    /schedule_outbox:\s*["']\+\+sequence, &\[scope\+courseId\], scope, mutationId, createdAt["']/,
  );
  assert.match(source, /schedule_sync_state:\s*["']&scope["']/);
  assert.match(
    source,
    /schedule_conflicts:\s*["']&key, scope, courseId["']/,
  );
  const version11Stores =
    source.match(/this\.version\(11\)\.stores\(\{([\s\S]*?)\}\)\.upgrade/)?.[1] ??
    "";
  assert.doesNotMatch(version11Stores, /schedule_courses\s*:/);
});

test("database v11 parses all legacy courses before writes and clears only after migration", async () => {
  const source = await readFile(new URL("../db.ts", import.meta.url), "utf8");
  const migration = source.slice(source.indexOf("this.version(11)"));
  const legacyRead = migration.indexOf('tx.table("schedule_courses").toArray()');
  const parse = migration.indexOf("parseStoredScheduleCourse");
  const bulkPut = migration.indexOf(
    'tx.table("schedule_scoped_courses").bulkPut(migrated)',
  );
  const clear = migration.indexOf('tx.table("schedule_courses").clear()');

  assert.ok(legacyRead >= 0);
  assert.ok(parse > legacyRead);
  assert.ok(bulkPut > parse);
  assert.ok(clear > bulkPut);
  assert.match(migration, /scope:\s*GUEST_SCHEDULE_SCOPE/);
  assert.match(migration, /key:\s*scopedCourseKey\(GUEST_SCHEDULE_SCOPE,\s*course\.id\)/);
});

test("database v11 functionally migrates a valid v10 course and retains its key path", async (t) => {
  await deleteTestDatabase();
  await seedLegacyDatabase(LEGACY_COURSE);

  const database = new VSUDatabase();
  t.after(async () => {
    database.close();
    await deleteTestDatabase();
  });
  await database.open();

  assert.deepEqual(await database.schedule_scoped_courses.toArray(), [
    {
      key: `guest|${LEGACY_COURSE.id}`,
      scope: GUEST_SCHEDULE_SCOPE,
      id: LEGACY_COURSE.id,
      course: LEGACY_COURSE,
    },
  ]);
  assert.equal(await database.schedule_courses.count(), 0);
  const transaction = database
    .backendDB()
    .transaction("schedule_courses", "readonly");
  assert.equal(transaction.objectStore("schedule_courses").keyPath, "id");
  assert.equal(await database.schedule_outbox.count(), 0);
});

test("malformed legacy data aborts v11 and remains readable under the retained v10 schema", async (t) => {
  await deleteTestDatabase();
  t.after(deleteTestDatabase);
  const malformed = {
    id: LEGACY_COURSE.id,
    code: LEGACY_COURSE.code,
    updatedAt: LEGACY_COURSE.updatedAt,
  };
  await seedLegacyDatabase(malformed);

  const database = new VSUDatabase();
  await assert.rejects(database.open());
  database.close();

  assert.deepEqual(await readLegacyCourses(), [malformed]);
});

test("a target write failure rolls back migrated rows and preserves the v10 legacy course", async (t) => {
  await deleteTestDatabase();
  t.after(deleteTestDatabase);
  await seedLegacyDatabase(LEGACY_COURSE);

  const database = new VSUDatabase();
  database.schedule_scoped_courses.hook("creating", () => {
    throw new Error("injected target write failure");
  });
  await assert.rejects(database.open(), /injected target write failure/);
  database.close();

  assert.deepEqual(await readLegacyCourses(), [LEGACY_COURSE]);
});
