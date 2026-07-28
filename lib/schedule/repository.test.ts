import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { ScheduleCourse } from "./types";
import { ScheduleValidationError } from "./validation";
import {
  ScheduleRepository,
  ScheduleStorageError,
  type ScheduleStore,
} from "./repository";

const COURSE_ID = "123e4567-e89b-42d3-a456-426614174000";
const OTHER_ID = "123e4567-e89b-42d3-a456-426614174002";
const MEETING_ID = "123e4567-e89b-42d3-a456-426614174001";
const CREATED_AT = "2026-07-01T01:02:03.000Z";
const UPDATED_AT = "2026-07-02T01:02:03.000Z";

function storedCourse(id = COURSE_ID): ScheduleCourse {
  return {
    id,
    code: "CS 101",
    title: "Introduction to Computing",
    color: "blue",
    meetings: [
      {
        id: MEETING_ID,
        days: [1, 3],
        startMinute: 480,
        endMinute: 540,
      },
    ],
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  };
}

class FakeStore implements ScheduleStore {
  rows: unknown[];
  replaceCalls = 0;

  constructor(rows: unknown[] = []) {
    this.rows = structuredClone(rows);
  }

  async list(): Promise<unknown[]> {
    return structuredClone(this.rows);
  }

  async put(course: ScheduleCourse): Promise<void> {
    const index = this.rows.findIndex(
      (row) => typeof row === "object" && row !== null && "id" in row && row.id === course.id,
    );
    if (index >= 0) this.rows[index] = structuredClone(course);
    else this.rows.push(structuredClone(course));
  }

  async remove(id: string): Promise<void> {
    this.rows = this.rows.filter(
      (row) => !(typeof row === "object" && row !== null && "id" in row && row.id === id),
    );
  }

  async clear(): Promise<void> {
    this.rows = [];
  }

  async replaceAll(courses: ScheduleCourse[]): Promise<void> {
    this.replaceCalls += 1;
    this.rows = structuredClone(courses);
  }
}

test("CRUD methods persist normalized courses and await completion", async () => {
  const store = new FakeStore();
  const repository = new ScheduleRepository(() => store);
  const saved = await repository.put({
    ...storedCourse(),
    code: "  CS 101  ",
    updatedAt: CREATED_AT,
  });

  assert.equal(saved.code, "CS 101");
  assert.equal(store.rows.length, 1);
  assert.deepEqual(await repository.list(), [saved]);

  await repository.remove(COURSE_ID);
  assert.deepEqual(await repository.list(), []);

  await repository.put(storedCourse());
  await repository.clear();
  assert.deepEqual(store.rows, []);
});

test("put validates before writing", async () => {
  const store = new FakeStore();
  const repository = new ScheduleRepository(() => store);

  await assert.rejects(
    repository.put({ ...storedCourse(), code: "" }),
    ScheduleValidationError,
  );
  assert.deepEqual(store.rows, []);
});

test("list parses stored rows without changing persisted timestamps", async () => {
  const store = new FakeStore([storedCourse()]);
  const result = await new ScheduleRepository(() => store).list();

  assert.equal(result[0]?.createdAt, CREATED_AT);
  assert.equal(result[0]?.updatedAt, UPDATED_AT);
});

test("replaceAll validates all courses before one atomic store call", async () => {
  const store = new FakeStore([storedCourse()]);
  const repository = new ScheduleRepository(() => store);

  const result = await repository.replaceAll([
    storedCourse(COURSE_ID),
    storedCourse(OTHER_ID),
  ]);

  assert.equal(store.replaceCalls, 1);
  assert.deepEqual(store.rows, result);
});

test("invalid or duplicate replacement makes no store call and leaves data unchanged", async () => {
  for (const replacement of [
    [{ ...storedCourse(), title: "" }],
    [storedCourse(), storedCourse()],
  ]) {
    const original = [storedCourse(OTHER_ID)];
    const store = new FakeStore(original);
    const repository = new ScheduleRepository(() => store);

    await assert.rejects(repository.replaceAll(replacement), ScheduleValidationError);
    assert.equal(store.replaceCalls, 0);
    assert.deepEqual(store.rows, original);
  }
});

test("malformed stored rows become a safe corrupt storage error", async () => {
  const repository = new ScheduleRepository(
    () => new FakeStore([{ secret: "must not leak" }]),
  );

  await assert.rejects(repository.list(), (error: unknown) => {
    assert.ok(error instanceof ScheduleStorageError);
    assert.equal(error.code, "corrupt");
    assert.doesNotMatch(error.message, /secret|must not leak/);
    return true;
  });
});

test("storage failures have stable quota, unavailable, and unknown classifications", async () => {
  const cases = [
    ["QuotaExceededError", "quota"],
    ["InvalidStateError", "unavailable"],
    ["SecurityError", "unavailable"],
    ["UnexpectedPlatformFailure", "unknown"],
  ] as const;

  for (const [name, code] of cases) {
    const store = new FakeStore();
    store.list = async () => {
      throw Object.assign(new Error("private platform detail"), { name });
    };

    await assert.rejects(
      new ScheduleRepository(() => store).list(),
      (error: unknown) => {
        assert.ok(error instanceof ScheduleStorageError);
        assert.equal(error.code, code);
        assert.doesNotMatch(error.message, /private platform detail/);
        return true;
      },
    );
  }
});

test("nested Dexie bulk failures retain quota and unavailable classifications", async () => {
  const cases = [
    [
      {
        name: "BulkError",
        failures: [Object.assign(new Error("private"), { name: "QuotaExceededError" })],
      },
      "quota",
    ],
    [
      {
        name: "BulkError",
        failuresByPos: {
          0: Object.assign(new Error("private"), { name: "DatabaseClosedError" }),
        },
      },
      "unavailable",
    ],
    [
      {
        name: "BulkError",
        cause: Object.assign(new Error("private"), { name: "SecurityError" }),
      },
      "unavailable",
    ],
  ] as const;

  for (const [failure, code] of cases) {
    const store = new FakeStore();
    store.replaceAll = async () => {
      throw failure;
    };

    await assert.rejects(
      new ScheduleRepository(() => store).replaceAll([storedCourse()]),
      (error: unknown) => {
        assert.ok(error instanceof ScheduleStorageError);
        assert.equal(error.code, code);
        assert.doesNotMatch(error.message, /private/);
        return true;
      },
    );
  }
});

test("remove rejects invalid IDs without touching storage", async () => {
  const store = new FakeStore([storedCourse()]);
  const repository = new ScheduleRepository(() => store);

  await assert.rejects(repository.remove("not-a-uuid"), ScheduleValidationError);
  assert.deepEqual(store.rows, [storedCourse()]);
});

test("database schema adds only the exact version 10 schedule table declaration", async () => {
  const source = await readFile(new URL("../db.ts", import.meta.url), "utf8");
  const version10 = source.match(
    /this\.version\(10\)\.stores\(\{\s*schedule_courses:\s*["']id, code, updatedAt["'],?\s*\}\);/,
  );

  assert.ok(version10, "expected exact schedule_courses v10 schema");
  assert.match(source, /this\.version\(9\)\.stores\(\{\s*boarding_houses:\s*["']id, name, slug["'],?\s*\}\);/);
  assert.equal((source.match(/this\.version\(10\)/g) ?? []).length, 1);
});
