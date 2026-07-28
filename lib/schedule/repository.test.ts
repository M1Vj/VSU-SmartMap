import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";

import { VSUDatabase } from "../db";
import {
  MAX_SCHEDULE_COURSES,
  type ScheduleCourse,
} from "./types";
import { ScheduleValidationError } from "./validation";
import {
  ScheduleCourseLimitError,
  ScheduleRepository,
  ScheduleStorageError,
  createDexieScopedScheduleStore,
  type ScopedScheduleStore,
} from "./repository";
import {
  GUEST_SCHEDULE_SCOPE,
  accountScheduleScope,
  type ScheduleScope,
} from "./scope";
import {
  scopedCourseKey,
  type ScheduleOutboxMutation,
  type StoredScopedScheduleCourse,
} from "./local-types";
import { desiredScheduleMutation, type ScheduleMutationDependencies } from "./outbox";

const COURSE_ID = "123e4567-e89b-42d3-a456-426614174000";
const OTHER_ID = "123e4567-e89b-42d3-a456-426614174002";
const MEETING_ID = "123e4567-e89b-42d3-a456-426614174001";
const CREATED_AT = "2026-07-01T01:02:03.000Z";
const UPDATED_AT = "2026-07-02T01:02:03.000Z";
const DATABASE_NAME = "VSUSmartMapDB";
Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

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
  outbox: ScheduleOutboxMutation[] = [];
  transactions = 0;
  replaceCalls = 0;
  failOutbox = false;

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

  async accountPut(
    scope: ScheduleScope,
    course: ScheduleCourse,
    maximumCourses: number,
    dependencies: ScheduleMutationDependencies,
  ): Promise<void> {
    this.transactions += 1;
    const beforeRows = structuredClone(this.rows);
    const beforeOutbox = structuredClone(this.outbox);
    try {
      await this.put(scope, course, maximumCourses);
      const row = beforeRows.find((item) => item.key === scopedCourseKey(scope, course.id));
      const existing = beforeOutbox.find(
        (item) => item.scope === scope && item.courseId === course.id,
      );
      this.persistMutation(desiredScheduleMutation({
        existing,
        scope,
        course,
        operation: "upsert",
        knownRevision: row?.serverRevision,
        ...dependencies,
      })!);
    } catch (error) {
      this.rows = beforeRows;
      this.outbox = beforeOutbox;
      throw error;
    }
  }

  async accountRemove(
    scope: ScheduleScope,
    id: string,
    dependencies: ScheduleMutationDependencies,
  ): Promise<void> {
    this.transactions += 1;
    const row = this.rows.find((item) => item.key === scopedCourseKey(scope, id));
    const existing = this.outbox.find(
      (item) => item.scope === scope && item.courseId === id,
    );
    await this.remove(scope, id);
    this.outbox = this.outbox.filter(
      (item) => item.scope !== scope || item.courseId !== id,
    );
    const mutation = desiredScheduleMutation({
      existing,
      scope,
      courseId: id,
      operation: "delete",
      knownRevision: row?.serverRevision,
      ...dependencies,
    });
    if (mutation) this.persistMutation(mutation);
  }

  async accountClear(
    scope: ScheduleScope,
    dependencies: ScheduleMutationDependencies,
  ): Promise<void> {
    this.transactions += 1;
    const rows = this.rows.filter((row) => row.scope === scope);
    await this.clear(scope);
    for (const row of rows) {
      const id = row.id;
      const mutation = desiredScheduleMutation({
        existing: this.outbox.find(
          (item) => item.scope === scope && item.courseId === id,
        ),
        scope,
        courseId: id,
        operation: "delete",
        knownRevision: row.serverRevision,
        ...dependencies,
      });
      this.outbox = this.outbox.filter(
        (item) => item.scope !== scope || item.courseId !== id,
      );
      if (mutation) this.persistMutation(mutation);
    }
  }

  async accountReplaceAll(
    scope: ScheduleScope,
    courses: ScheduleCourse[],
    maximumCourses: number,
    dependencies: ScheduleMutationDependencies,
  ): Promise<void> {
    this.transactions += 1;
    const rows = this.rows.filter((row) => row.scope === scope);
    const desired = new Map(courses.map((course) => [course.id, course]));
    const ids = new Set([
      ...rows.map((row) => row.id),
      ...this.outbox.filter((item) => item.scope === scope).map((item) => item.courseId),
      ...desired.keys(),
    ]);
    await this.replaceAll(scope, courses, maximumCourses);
    for (const id of ids) {
      const course = desired.get(id);
      const mutation = desiredScheduleMutation({
        existing: this.outbox.find(
          (item) => item.scope === scope && item.courseId === id,
        ),
        scope,
        courseId: id,
        operation: course ? "upsert" : "delete",
        course,
        knownRevision: rows.find((row) => row.id === id)?.serverRevision,
        ...dependencies,
      });
      this.outbox = this.outbox.filter(
        (item) => item.scope !== scope || item.courseId !== id,
      );
      if (mutation) this.persistMutation(mutation);
    }
  }

  private persistMutation(mutation: ScheduleOutboxMutation): void {
    if (this.failOutbox) throw new Error("outbox failure");
    this.outbox = this.outbox.filter(
      (item) =>
        item.scope !== mutation.scope || item.courseId !== mutation.courseId,
    );
    this.outbox.push(structuredClone(mutation));
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

test("a real malformed v10 upgrade is classified as corrupt without leaking row detail", async (t) => {
  await Dexie.delete(DATABASE_NAME);
  const legacy = new Dexie(DATABASE_NAME);
  legacy.version(10).stores({
    schedule_courses: "id, code, updatedAt",
  });
  const malformed = {
    id: COURSE_ID,
    code: "PRIVATE-COURSE-CODE",
    updatedAt: UPDATED_AT,
  };
  await legacy.open();
  await legacy.table("schedule_courses").put(malformed);
  legacy.close();

  const database = new VSUDatabase();
  t.after(async () => {
    database.close();
    await Dexie.delete(DATABASE_NAME);
  });
  const store = new FakeStore();
  store.list = async (scope) => {
    const rows = await database.schedule_scoped_courses
      .where("scope")
      .equals(scope)
      .toArray();
    return rows.map((row) => row.course);
  };

  await assert.rejects(
    new ScheduleRepository(GUEST_SCHEDULE_SCOPE, () => store).list(),
    (error: unknown) => {
      assert.ok(error instanceof ScheduleStorageError);
      assert.equal(error.code, "corrupt");
      assert.doesNotMatch(error.message, /PRIVATE-COURSE-CODE|updatedAt|meetings/);
      return true;
    },
  );
});

test("direct validation failures from storage are classified as corrupt", async () => {
  const store = new FakeStore();
  store.list = async () => {
    throw new ScheduleValidationError([
      { field: "private-field", message: "private row detail" },
    ]);
  };

  await assert.rejects(
    new ScheduleRepository(GUEST_SCHEDULE_SCOPE, () => store).list(),
    (error: unknown) => {
      assert.ok(error instanceof ScheduleStorageError);
      assert.equal(error.code, "corrupt");
      assert.doesNotMatch(error.message, /private-field|private row detail/);
      return true;
    },
  );
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

test("account put writes course and mutation in one transaction while guest never queues", async () => {
  const accountScope = accountScheduleScope("11111111-1111-4111-8111-111111111111");
  const store = new FakeStore();
  const account = new ScheduleRepository(accountScope, () => store);
  await account.put(storedCourse());
  assert.equal(store.transactions, 1);
  assert.equal(store.rows.length, 1);
  assert.deepEqual(store.outbox.map((item) => item.operation), ["upsert"]);

  const guestStore = new FakeStore();
  await new ScheduleRepository(GUEST_SCHEDULE_SCOPE, () => guestStore).put(storedCourse());
  assert.equal(guestStore.outbox.length, 0);
  assert.equal(guestStore.transactions, 0);
});

test("failed outbox persistence rolls back the account course change", async () => {
  const scope = accountScheduleScope("11111111-1111-4111-8111-111111111111");
  const store = new FakeStore();
  store.failOutbox = true;
  await assert.rejects(new ScheduleRepository(scope, () => store).put(storedCourse()));
  assert.deepEqual(store.rows, []);
  assert.deepEqual(store.outbox, []);
});

test("repeated edits coalesce and create then delete becomes net zero", async () => {
  const scope = accountScheduleScope("11111111-1111-4111-8111-111111111111");
  const store = new FakeStore();
  const repository = new ScheduleRepository(scope, () => store);
  await repository.put(storedCourse());
  await repository.put({ ...storedCourse(), title: "Latest title" });
  assert.equal(store.outbox.length, 1);
  assert.equal(store.outbox[0]?.course?.title, "Latest title");
  assert.equal(store.outbox[0]?.expectedRevision, 0);
  await repository.remove(COURSE_ID);
  assert.deepEqual(store.rows, []);
  assert.deepEqual(store.outbox, []);
});

test("delete then recreate retains the original known server revision", async () => {
  const scope = accountScheduleScope("11111111-1111-4111-8111-111111111111");
  const store = new FakeStore();
  store.rows = [{
    key: scopedCourseKey(scope, COURSE_ID),
    scope,
    id: COURSE_ID,
    course: storedCourse(),
    serverRevision: 12,
  }];
  const repository = new ScheduleRepository(scope, () => store);
  await repository.remove(COURSE_ID);
  await repository.put({ ...storedCourse(), title: "Restored" });
  assert.equal(store.outbox.length, 1);
  assert.equal(store.outbox[0]?.operation, "upsert");
  assert.equal(store.outbox[0]?.expectedRevision, 12);
});

test("real IndexedDB atomically rolls back and coalesces account writes", async (t) => {
  await Dexie.delete(DATABASE_NAME);
  const database = new VSUDatabase();
  const scope = accountScheduleScope("11111111-1111-4111-8111-111111111111");
  const otherScope = accountScheduleScope("22222222-2222-4222-8222-222222222222");
  const store = createDexieScopedScheduleStore(database);
  t.after(async () => {
    database.close();
    await Dexie.delete(DATABASE_NAME);
  });

  const failing = new ScheduleRepository(scope, () => store, {
    mutationId: () => "invalid",
    now: () => new Date(CREATED_AT),
  });
  await assert.rejects(failing.put(storedCourse()), ScheduleStorageError);
  assert.equal(await database.schedule_scoped_courses.count(), 0);
  assert.equal(await database.schedule_outbox.count(), 0);

  const mutationIds = [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  ];
  const repository = new ScheduleRepository(scope, () => store, {
    mutationId: () => mutationIds.shift()!,
    now: () => new Date(CREATED_AT),
  });
  await repository.put(storedCourse());
  await repository.put({ ...storedCourse(), title: "Latest" });
  const coalesced = await database.schedule_outbox
    .where("[scope+courseId]")
    .equals([scope, COURSE_ID])
    .first();
  assert.equal(coalesced?.mutationId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  assert.equal(coalesced?.expectedRevision, 0);
  assert.equal(coalesced?.course?.title, "Latest");

  await new ScheduleRepository(otherScope, () => store, {
    mutationId: () => "ffffffff-ffff-4fff-8fff-ffffffffffff",
    now: () => new Date(CREATED_AT),
  }).put({ ...storedCourse(), title: "Other account" });
  await repository.remove(COURSE_ID);
  assert.equal(
    await database.schedule_outbox.where("scope").equals(scope).count(),
    0,
  );
  assert.equal(
    await database.schedule_outbox.where("scope").equals(otherScope).count(),
    1,
  );
  assert.equal(
    await database.schedule_scoped_courses.where("scope").equals(otherScope).count(),
    1,
  );
});

test("real IndexedDB clear and restore create bounded per-course desired mutations", async (t) => {
  await Dexie.delete(DATABASE_NAME);
  const database = new VSUDatabase();
  const scope = accountScheduleScope("11111111-1111-4111-8111-111111111111");
  const store = createDexieScopedScheduleStore(database);
  let nextId = 1;
  const repository = new ScheduleRepository(scope, () => store, {
    mutationId: () =>
      `00000000-0000-4000-8000-${(nextId++).toString(16).padStart(12, "0")}`,
    now: () => new Date(CREATED_AT),
  });
  t.after(async () => {
    database.close();
    await Dexie.delete(DATABASE_NAME);
  });

  await database.schedule_scoped_courses.bulkAdd([
    {
      key: scopedCourseKey(scope, COURSE_ID),
      scope,
      id: COURSE_ID,
      course: storedCourse(COURSE_ID),
      serverRevision: 4,
    },
    {
      key: scopedCourseKey(scope, OTHER_ID),
      scope,
      id: OTHER_ID,
      course: storedCourse(OTHER_ID),
      serverRevision: 8,
    },
  ]);
  await repository.clear();
  const deletes = await database.schedule_outbox.where("scope").equals(scope).toArray();
  assert.deepEqual(
    deletes.map(({ courseId, expectedRevision, operation }) => ({
      courseId,
      expectedRevision,
      operation,
    })).sort((a, b) => a.courseId.localeCompare(b.courseId)),
    [
      { courseId: COURSE_ID, expectedRevision: 4, operation: "delete" },
      { courseId: OTHER_ID, expectedRevision: 8, operation: "delete" },
    ],
  );
  await repository.replaceAll([storedCourse(COURSE_ID), storedCourse(OTHER_ID)]);
  const restores = await database.schedule_outbox.where("scope").equals(scope).toArray();
  assert.deepEqual(
    restores.map(({ courseId, expectedRevision, operation }) => ({
      courseId,
      expectedRevision,
      operation,
    })).sort((a, b) => a.courseId.localeCompare(b.courseId)),
    [
      { courseId: COURSE_ID, expectedRevision: 4, operation: "upsert" },
      { courseId: OTHER_ID, expectedRevision: 8, operation: "upsert" },
    ],
  );
  assert.equal(await database.schedule_scoped_courses.where("scope").equals(scope).count(), 2);
});

test("real IndexedDB delete then recreate reads the pending compound index", async (t) => {
  await Dexie.delete(DATABASE_NAME);
  const database = new VSUDatabase();
  const scope = accountScheduleScope("11111111-1111-4111-8111-111111111111");
  t.after(async () => {
    database.close();
    await Dexie.delete(DATABASE_NAME);
  });
  await database.schedule_scoped_courses.add({
    key: scopedCourseKey(scope, COURSE_ID),
    scope,
    id: COURSE_ID,
    course: storedCourse(),
    serverRevision: 12,
  });
  const ids = [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  ];
  const dependencies = {
    mutationId: () => ids.shift()!,
    now: () => new Date(CREATED_AT),
  };
  await new ScheduleRepository(
    scope,
    () => createDexieScopedScheduleStore(database),
    dependencies,
  ).remove(COURSE_ID);
  await new ScheduleRepository(
    scope,
    () => createDexieScopedScheduleStore(database),
    dependencies,
  ).put({ ...storedCourse(), title: "Recreated" });

  const mutations = await database.schedule_outbox.where("scope").equals(scope).toArray();
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0]?.operation, "upsert");
  assert.equal(mutations[0]?.expectedRevision, 12);
  assert.equal(mutations[0]?.mutationId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
});

test("real IndexedDB rolls back remove clear and replaceAll when outbox creation fails", async (t) => {
  await Dexie.delete(DATABASE_NAME);
  const database = new VSUDatabase();
  const scope = accountScheduleScope("11111111-1111-4111-8111-111111111111");
  const store = createDexieScopedScheduleStore(database);
  const failingRepository = new ScheduleRepository(scope, () => store, {
    mutationId: () => "invalid",
    now: () => new Date(CREATED_AT),
  });
  t.after(async () => {
    database.close();
    await Dexie.delete(DATABASE_NAME);
  });

  const seed = async () => {
    await database.schedule_scoped_courses.clear();
    await database.schedule_outbox.clear();
    await database.schedule_scoped_courses.bulkAdd([
      {
        key: scopedCourseKey(scope, COURSE_ID),
        scope,
        id: COURSE_ID,
        course: storedCourse(COURSE_ID),
        serverRevision: 4,
      },
      {
        key: scopedCourseKey(scope, OTHER_ID),
        scope,
        id: OTHER_ID,
        course: storedCourse(OTHER_ID),
        serverRevision: 8,
      },
    ]);
  };
  const snapshot = async () => ({
    courses: await database.schedule_scoped_courses.toArray(),
    outbox: await database.schedule_outbox.toArray(),
  });

  await seed();
  const beforeRemove = await snapshot();
  await assert.rejects(failingRepository.remove(COURSE_ID), ScheduleStorageError);
  assert.deepEqual(await snapshot(), beforeRemove);

  await seed();
  const beforeClear = await snapshot();
  await assert.rejects(failingRepository.clear(), ScheduleStorageError);
  assert.deepEqual(await snapshot(), beforeClear);

  await seed();
  const beforeReplace = await snapshot();
  await assert.rejects(
    failingRepository.replaceAll([{ ...storedCourse(COURSE_ID), title: "Changed" }]),
    ScheduleStorageError,
  );
  assert.deepEqual(await snapshot(), beforeReplace);
});

test("real IndexedDB clear preserves absent pending deletes and replaceAll unions affected IDs", async (t) => {
  await Dexie.delete(DATABASE_NAME);
  const database = new VSUDatabase();
  const scope = accountScheduleScope("11111111-1111-4111-8111-111111111111");
  const otherScope = accountScheduleScope("22222222-2222-4222-8222-222222222222");
  const absentId = courseId(99);
  const store = createDexieScopedScheduleStore(database);
  let nextId = 1;
  const repository = new ScheduleRepository(scope, () => store, {
    mutationId: () =>
      `00000000-0000-4000-8000-${(nextId++).toString(16).padStart(12, "0")}`,
    now: () => new Date(CREATED_AT),
  });
  t.after(async () => {
    database.close();
    await Dexie.delete(DATABASE_NAME);
  });
  await database.schedule_outbox.bulkAdd([
    {
      mutationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      scope,
      courseId: absentId,
      expectedRevision: 6,
      operation: "delete",
      createdAt: CREATED_AT,
    },
    {
      mutationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      scope: otherScope,
      courseId: COURSE_ID,
      expectedRevision: 3,
      operation: "delete",
      createdAt: CREATED_AT,
    },
  ]);
  await repository.clear();
  assert.equal(
    (await database.schedule_outbox
      .where("[scope+courseId]")
      .equals([scope, absentId])
      .first())?.expectedRevision,
    6,
  );
  await repository.replaceAll([storedCourse(absentId), storedCourse(OTHER_ID)]);
  const scoped = await database.schedule_outbox.where("scope").equals(scope).toArray();
  assert.equal(scoped.length, 2);
  assert.equal(scoped.find((item) => item.courseId === absentId)?.expectedRevision, 6);
  assert.equal(
    await database.schedule_outbox.where("scope").equals(otherScope).count(),
    1,
  );
});

test("real IndexedDB account replacement enforces the practical 200-course bound atomically", async (t) => {
  await Dexie.delete(DATABASE_NAME);
  const database = new VSUDatabase();
  const scope = accountScheduleScope("11111111-1111-4111-8111-111111111111");
  let nextMutation = 1;
  const repository = new ScheduleRepository(
    scope,
    () => createDexieScopedScheduleStore(database),
    {
      mutationId: () =>
        `10000000-0000-4000-8000-${(nextMutation++).toString(16).padStart(12, "0")}`,
      now: () => new Date(CREATED_AT),
    },
  );
  t.after(async () => {
    database.close();
    await Dexie.delete(DATABASE_NAME);
  });
  const maximum = Array.from({ length: MAX_SCHEDULE_COURSES }, (_, index) =>
    storedCourse(courseId(index)),
  );
  await repository.replaceAll(maximum);
  assert.equal(
    await database.schedule_scoped_courses.where("scope").equals(scope).count(),
    MAX_SCHEDULE_COURSES,
  );
  assert.equal(
    await database.schedule_outbox.where("scope").equals(scope).count(),
    MAX_SCHEDULE_COURSES,
  );
  const before = await database.schedule_outbox.toArray();
  await assert.rejects(
    repository.replaceAll([...maximum, storedCourse(courseId(MAX_SCHEDULE_COURSES))]),
    ScheduleCourseLimitError,
  );
  assert.equal(
    await database.schedule_scoped_courses.where("scope").equals(scope).count(),
    MAX_SCHEDULE_COURSES,
  );
  assert.deepEqual(await database.schedule_outbox.toArray(), before);
});
