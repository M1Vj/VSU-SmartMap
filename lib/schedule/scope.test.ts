import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GUEST_SCHEDULE_SCOPE,
  accountScheduleScope,
} from "./scope.ts";

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

test("database v11 declares the exact scoped stores and retains the empty legacy store", async () => {
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
  assert.match(source, /version\(11\)[\s\S]+schedule_courses:\s*["']["']/);
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
