import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MAX_SCHEDULE_COURSES,
  type ScheduleCourse,
} from "./types";
import { ScheduleValidationError } from "./validation";
import {
  ScheduleCourseLimitError,
  ScheduleRepository,
  ScheduleStorageError,
  type ScopedScheduleStore,
} from "./repository";
import {
  GUEST_SCHEDULE_SCOPE,
  accountScheduleScope,
  type ScheduleScope,
} from "./scope";
import {
  scopedCourseKey,
  type StoredScopedScheduleCourse,
} from "./local-types";

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

function courseId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

class FakeStore implements ScopedScheduleStore {
  rows: StoredScopedScheduleCourse[];
  replaceCalls = 0;

  constructor(
    rows: unknown[] = [],
    scope: ScheduleScope = GUEST_SCHEDULE_SCOPE,
  ) {
    this.rows = rows.map((course) => {
      const id =
        typeof course === "object" && course !== null && "id" in course
          ? String(course.id)
          : "corrupt";
      return {
        key: scopedCourseKey(scope, id),
        scope,
        id,
        course: structuredClone(course) as ScheduleCourse,
      };
    });
  }

  async list(scope: ScheduleScope): Promise<unknown[]> {
    return structuredClone(
      this.rows.filter((row) => row.scope === scope).map((row) => row.course),
    );
  }

  async put(
    scope: ScheduleScope,
    course: ScheduleCourse,
    maximumCourses: number,
  ): Promise<void> {
    const key = scopedCourseKey(scope, course.id);
    const index = this.rows.findIndex((row) => row.key === key);
    if (index >= 0) {
      this.rows[index] = { key, scope, id: course.id, course: structuredClone(course) };
    }
    else {
      if (this.rows.filter((row) => row.scope === scope).length >= maximumCourses) {
        throw new ScheduleCourseLimitError();
      }
      this.rows.push({ key, scope, id: course.id, course: structuredClone(course) });
    }
  }

  async remove(scope: ScheduleScope, id: string): Promise<void> {
    const key = scopedCourseKey(scope, id);
    this.rows = this.rows.filter((row) => row.key !== key);
  }

  async clear(scope: ScheduleScope): Promise<void> {
    this.rows = this.rows.filter((row) => row.scope !== scope);
  }

  async replaceAll(
    scope: ScheduleScope,
    courses: ScheduleCourse[],
    maximumCourses: number,
  ): Promise<void> {
    if (courses.length > maximumCourses) {
      throw new ScheduleCourseLimitError();
    }
    this.replaceCalls += 1;
    this.rows = this.rows.filter((row) => row.scope !== scope);
    this.rows.push(
      ...courses.map((course) => ({
        key: scopedCourseKey(scope, course.id),
        scope,
        id: course.id,
        course: structuredClone(course),
      })),
    );
  }
}

test("CRUD methods persist normalized courses and await completion", async () => {
  const store = new FakeStore();
  const repository = new ScheduleRepository(GUEST_SCHEDULE_SCOPE, () => store);
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
  const repository = new ScheduleRepository(GUEST_SCHEDULE_SCOPE, () => store);

  await assert.rejects(
    repository.put({ ...storedCourse(), code: "" }),
    ScheduleValidationError,
  );
  assert.deepEqual(store.rows, []);
});

test("put refuses a new course at the shared limit but still permits editing", async () => {
  const store = new FakeStore(
    Array.from({ length: MAX_SCHEDULE_COURSES }, (_, index) =>
      storedCourse(courseId(index)),
    ),
  );
  const repository = new ScheduleRepository(GUEST_SCHEDULE_SCOPE, () => store);

  await assert.rejects(
    repository.put(storedCourse(courseId(MAX_SCHEDULE_COURSES))),
    ScheduleCourseLimitError,
  );
  assert.equal(store.rows.length, MAX_SCHEDULE_COURSES);

  const updated = await repository.put({
    ...storedCourse(courseId(0)),
    title: "Updated title",
  });
  assert.equal(updated.title, "Updated title");
  assert.equal(store.rows.length, MAX_SCHEDULE_COURSES);
});

test("list parses stored rows without changing persisted timestamps", async () => {
  const store = new FakeStore([storedCourse()]);
  const result = await new ScheduleRepository(GUEST_SCHEDULE_SCOPE, () => store).list();

  assert.equal(result[0]?.createdAt, CREATED_AT);
  assert.equal(result[0]?.updatedAt, UPDATED_AT);
});

test("replaceAll validates all courses before one atomic store call", async () => {
  const store = new FakeStore([storedCourse()]);
  const repository = new ScheduleRepository(GUEST_SCHEDULE_SCOPE, () => store);

  const result = await repository.replaceAll([
    storedCourse(COURSE_ID),
    storedCourse(OTHER_ID),
  ]);

  assert.equal(store.replaceCalls, 1);
  assert.deepEqual(await repository.list(), result);
});

test("invalid or duplicate replacement makes no store call and leaves data unchanged", async () => {
  for (const replacement of [
    [{ ...storedCourse(), title: "" }],
    [storedCourse(), storedCourse()],
  ]) {
    const original = [storedCourse(OTHER_ID)];
    const store = new FakeStore(original);
    const repository = new ScheduleRepository(GUEST_SCHEDULE_SCOPE, () => store);

    await assert.rejects(repository.replaceAll(replacement), ScheduleValidationError);
    assert.equal(store.replaceCalls, 0);
    assert.deepEqual(await repository.list(), original);
  }
});

test("replaceAll rejects schedules above the shared course limit atomically", async () => {
  const original = [storedCourse(OTHER_ID)];
  const store = new FakeStore(original);
  const repository = new ScheduleRepository(GUEST_SCHEDULE_SCOPE, () => store);
  const oversized = Array.from(
    { length: MAX_SCHEDULE_COURSES + 1 },
    (_, index) => storedCourse(courseId(index)),
  );

  await assert.rejects(
    repository.replaceAll(oversized),
    ScheduleCourseLimitError,
  );
  assert.equal(store.replaceCalls, 0);
  assert.deepEqual(await repository.list(), original);
});

test("malformed stored rows become a safe corrupt storage error", async () => {
  const repository = new ScheduleRepository(
    GUEST_SCHEDULE_SCOPE,
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
      new ScheduleRepository(GUEST_SCHEDULE_SCOPE, () => store).list(),
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
      new ScheduleRepository(GUEST_SCHEDULE_SCOPE, () => store).replaceAll([storedCourse()]),
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
  const repository = new ScheduleRepository(GUEST_SCHEDULE_SCOPE, () => store);

  await assert.rejects(repository.remove("not-a-uuid"), ScheduleValidationError);
  assert.deepEqual(await repository.list(), [storedCourse()]);
});

test("database schema preserves v10 and adds one v11 declaration", async () => {
  const source = await readFile(new URL("../db.ts", import.meta.url), "utf8");
  const version10 = source.match(
    /this\.version\(10\)\.stores\(\{\s*schedule_courses:\s*["']id, code, updatedAt["'],?\s*\}\);/,
  );

  assert.ok(version10, "expected exact schedule_courses v10 schema");
  assert.match(source, /this\.version\(9\)\.stores\(\{\s*boarding_houses:\s*["']id, name, slug["'],?\s*\}\);/);
  assert.equal((source.match(/this\.version\(10\)/g) ?? []).length, 1);
  assert.equal((source.match(/this\.version\(11\)/g) ?? []).length, 1);
});

test("repositories sharing one store isolate guest and account CRUD", async () => {
  const store = new FakeStore();
  const accountScope = accountScheduleScope(
    "11111111-1111-4111-8111-111111111111",
  );
  const guest = new ScheduleRepository(GUEST_SCHEDULE_SCOPE, () => store);
  const account = new ScheduleRepository(accountScope, () => store);

  await guest.put(storedCourse());
  await account.put({ ...storedCourse(), title: "Account title" });
  assert.equal((await guest.list())[0]?.title, "Introduction to Computing");
  assert.equal((await account.list())[0]?.title, "Account title");
  assert.deepEqual(
    store.rows.map((row) => row.key).sort(),
    [
      scopedCourseKey(GUEST_SCHEDULE_SCOPE, COURSE_ID),
      scopedCourseKey(accountScope, COURSE_ID),
    ].sort(),
  );

  await guest.clear();
  assert.deepEqual(await guest.list(), []);
  assert.equal((await account.list())[0]?.title, "Account title");
});
