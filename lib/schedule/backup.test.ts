import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_SCHEDULE_BACKUP_BYTES,
  MAX_SCHEDULE_BACKUP_COURSES,
  ScheduleBackupError,
  exportScheduleBackup,
  parseScheduleBackup,
} from "./backup";
import type { ScheduleCourse } from "./types";

const COURSE_ID = "123e4567-e89b-42d3-a456-426614174000";
const MEETING_ID = "123e4567-e89b-42d3-a456-426614174001";
const CREATED_AT = "2026-07-01T01:02:03.000Z";
const UPDATED_AT = "2026-07-02T01:02:03.000Z";

function course(id = COURSE_ID, meetingId = MEETING_ID): ScheduleCourse {
  return {
    id,
    code: "CS 101",
    title: "Computing",
    color: "blue" as const,
    meetings: [{ id: meetingId, days: [1], startMinute: 480, endMinute: 540 }],
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  };
}

test("exports stable pretty JSON and round-trips stored courses", () => {
  const json = exportScheduleBackup(
    [course()],
    new Date("2026-07-28T00:00:00.000Z"),
  );
  assert.equal(json.endsWith("\n"), true);
  assert.match(json, /^\{\n  "version": 1,/);
  const parsed = parseScheduleBackup(json);
  assert.deepEqual(parsed.courses, [course()]);
  assert.equal(parsed.exportedAt, "2026-07-28T00:00:00.000Z");
});

test("round-trips the six-byte JSON-escape maximum across 200 courses", () => {
  const text = (length: number) => `${"\0".repeat(length - 2)}😀`;
  const courses: ScheduleCourse[] = Array.from(
    { length: MAX_SCHEDULE_BACKUP_COURSES },
    (_, courseIndex) => ({
      id: `123e4567-e89b-42d3-a456-${String(courseIndex).padStart(12, "0")}`,
      code: text(24),
      title: text(120),
      instructor: text(100),
      notes: text(500),
      color: "violet",
      meetings: Array.from({ length: 8 }, (_, meetingIndex) => ({
        id: `223e4567-e89b-42d3-a456-${String(courseIndex * 8 + meetingIndex).padStart(12, "0")}`,
        days: [1, 2, 3, 4, 5, 6, 7],
        startMinute: meetingIndex * 60,
        endMinute: meetingIndex * 60 + 60,
        facilityId: "323e4567-e89b-42d3-a456-426614174000",
        locationLabel: text(160),
      })),
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    }),
  );
  const exported = exportScheduleBackup(courses, new Date(UPDATED_AT));
  assert.ok(Buffer.byteLength(exported, "utf8") > 2 * 1024 * 1024);
  assert.ok(Buffer.byteLength(exported, "utf8") <= MAX_SCHEDULE_BACKUP_BYTES);
  assert.deepEqual(parseScheduleBackup(exported).courses, courses);
});

test("rejects an invalid export date with a typed user-safe error", () => {
  assert.throws(
    () => exportScheduleBackup([course()], new Date("invalid")),
    (error) =>
      error instanceof ScheduleBackupError &&
      !error.message.toLowerCase().includes("invalid time value"),
  );
});

test("rejects malformed documents with typed user-safe errors", () => {
  for (const input of [
    1,
    "{secret",
    "null",
    JSON.stringify({ version: 2, exportedAt: UPDATED_AT, courses: [] }),
    JSON.stringify({ version: 1, exportedAt: "bad", courses: [] }),
    JSON.stringify({ version: 1, exportedAt: UPDATED_AT, courses: {} }),
    JSON.stringify({
      version: 1,
      exportedAt: UPDATED_AT,
      courses: [],
      unknown: true,
    }),
  ]) {
    assert.throws(
      () => parseScheduleBackup(input as string),
      (error) =>
        error instanceof ScheduleBackupError &&
        !error.message.includes("secret") &&
        !JSON.stringify(error).includes("secret"),
    );
  }
});

test("rejects invalid courses without partial output", () => {
  const input = JSON.stringify({
    version: 1,
    exportedAt: UPDATED_AT,
    courses: [
      course(),
      { ...course("123e4567-e89b-42d3-a456-426614174002"), id: "bad" },
    ],
  });
  assert.throws(() => parseScheduleBackup(input), ScheduleBackupError);
});

test("regenerates later duplicate IDs deterministically without collisions", () => {
  const collision = "123e4567-e89b-42d3-a456-426614174009";
  const replacementCourse = "123e4567-e89b-42d3-a456-426614174010";
  const replacementMeeting = "123e4567-e89b-42d3-a456-426614174011";
  const values = [collision, replacementCourse, MEETING_ID, replacementMeeting];
  const input = JSON.stringify({
    version: 1,
    exportedAt: UPDATED_AT,
    courses: [
      course(),
      {
        ...course(COURSE_ID, MEETING_ID),
        meetings: [course().meetings[0], { ...course().meetings[0] }],
      },
      course(collision, "123e4567-e89b-42d3-a456-426614174012"),
    ],
  });
  const parsed = parseScheduleBackup(input, () => values.shift()!);
  assert.equal(parsed.courses[1]?.id, replacementCourse);
  assert.equal(parsed.courses[1]?.meetings[1]?.id, replacementMeeting);
  assert.equal(parsed.courses[2]?.id, collision);
});

test("rejects duplicate course IDs during export", () => {
  assert.throws(
    () => exportScheduleBackup([course(), course()], new Date(UPDATED_AT)),
    (error) =>
      error instanceof ScheduleBackupError && error.code === "invalid_course",
  );
});

test("duplicate repair changes only later duplicated IDs and preserves all content", () => {
  const replacementCourse = "123e4567-e89b-42d3-a456-426614174030";
  const replacementMeeting = "123e4567-e89b-42d3-a456-426614174031";
  const detailed = {
    ...course(),
    instructor: "Ada Lovelace",
    notes: "Bring laptop",
    meetings: [
      {
        ...course().meetings[0],
        facilityId: "123e4567-e89b-42d3-a456-426614174032",
        locationLabel: "Engineering 201",
      },
    ],
  };
  const duplicate = {
    ...structuredClone(detailed),
    meetings: [detailed.meetings[0], { ...detailed.meetings[0] }],
  };
  const parsed = parseScheduleBackup(
    JSON.stringify({
      version: 1,
      exportedAt: UPDATED_AT,
      courses: [detailed, duplicate],
    }),
    (() => {
      const ids = [replacementCourse, replacementMeeting];
      return () => ids.shift()!;
    })(),
  );
  assert.deepEqual(parsed.courses[0], detailed);
  assert.deepEqual(parsed.courses[1], {
    ...duplicate,
    id: replacementCourse,
    meetings: [
      duplicate.meetings[0],
      { ...duplicate.meetings[1], id: replacementMeeting },
    ],
  });
});

test("rejects stored content that strict parsing would silently normalize", () => {
  for (const invalid of [
    { ...course(), code: " CS 101 " },
    { ...course(), meetings: [{ ...course().meetings[0], days: [3, 1, 3] }] },
    { ...course(), unknown: "field" },
    { ...course(), id: COURSE_ID.toUpperCase() },
  ]) {
    assert.throws(
      () =>
        parseScheduleBackup(
          JSON.stringify({
            version: 1,
            exportedAt: UPDATED_AT,
            courses: [invalid],
          }),
        ),
      ScheduleBackupError,
    );
  }
});

test("rejects deeply nested unknown course fields without recursive traversal", () => {
  const valid = JSON.stringify(course());
  const deepUnknown = `${"[".repeat(10_000)}0${"]".repeat(10_000)}`;
  const hostileCourse = `${valid.slice(0, -1)},"unknown":${deepUnknown}}`;
  const input = `{"version":1,"exportedAt":${JSON.stringify(UPDATED_AT)},"courses":[${hostileCourse}]}`;
  assert.ok(Buffer.byteLength(input, "utf8") < MAX_SCHEDULE_BACKUP_BYTES);
  assert.throws(
    () => parseScheduleBackup(input),
    (error) =>
      error instanceof ScheduleBackupError &&
      error.code === "invalid_course" &&
      !(error instanceof RangeError),
  );
});

test("converts unexpected duplicate-ID repair failures to typed errors", () => {
  const input = JSON.stringify({
    version: 1,
    exportedAt: UPDATED_AT,
    courses: [course(), course()],
  });
  assert.throws(
    () =>
      parseScheduleBackup(input, () => {
        throw new RangeError("generator failure");
      }),
    (error) =>
      error instanceof ScheduleBackupError &&
      error.code === "invalid_course" &&
      !error.message.includes("generator failure"),
  );
});

test("regenerates duplicate meeting IDs only within the same course", () => {
  const replacement = "123e4567-e89b-42d3-a456-426614174013";
  const original = course();
  const input = JSON.stringify({
    version: 1,
    exportedAt: UPDATED_AT,
    courses: [
      {
        ...original,
        meetings: [original.meetings[0], { ...original.meetings[0] }],
      },
      course("123e4567-e89b-42d3-a456-426614174014", MEETING_ID),
    ],
  });
  const parsed = parseScheduleBackup(input, () => replacement);
  assert.equal(parsed.courses[0]?.meetings[1]?.id, replacement);
  assert.equal(parsed.courses[1]?.meetings[0]?.id, MEETING_ID);
});

test("enforces count and UTF-8 byte boundaries", () => {
  const emptyCourses = Array.from(
    { length: MAX_SCHEDULE_BACKUP_COURSES },
    (_, index) =>
      course(`123e4567-e89b-42d3-a456-${String(index).padStart(12, "0")}`),
  );
  assert.equal(
    parseScheduleBackup(
      JSON.stringify({
        version: 1,
        exportedAt: UPDATED_AT,
        courses: emptyCourses,
      }),
    ).courses.length,
    MAX_SCHEDULE_BACKUP_COURSES,
  );
  assert.throws(
    () =>
      parseScheduleBackup(
        JSON.stringify({
          version: 1,
          exportedAt: UPDATED_AT,
          courses: [...emptyCourses, course()],
        }),
      ),
    ScheduleBackupError,
  );
  const unicodeOverLimit = `"${"é".repeat(Math.floor(MAX_SCHEDULE_BACKUP_BYTES / 2))}"`;
  assert.ok(
    Buffer.byteLength(unicodeOverLimit, "utf8") > MAX_SCHEDULE_BACKUP_BYTES,
  );
  assert.throws(
    () => parseScheduleBackup(unicodeOverLimit),
    ScheduleBackupError,
  );
  assert.throws(
    () =>
      exportScheduleBackup([...emptyCourses, course()], new Date(UPDATED_AT)),
    ScheduleBackupError,
  );
});

test("rejects obviously oversized ASCII input", () => {
  const originalEncoder = globalThis.TextEncoder;
  Object.defineProperty(globalThis, "TextEncoder", {
    configurable: true,
    value: class {
      encode(): never {
        throw new Error("exact UTF-8 sizing should not run");
      }
    },
  });
  try {
    assert.throws(
      () => parseScheduleBackup("x".repeat(MAX_SCHEDULE_BACKUP_BYTES + 1)),
      (error) =>
        error instanceof ScheduleBackupError && error.code === "too_large",
    );
  } finally {
    Object.defineProperty(globalThis, "TextEncoder", {
      configurable: true,
      value: originalEncoder,
    });
  }
});

test("export does not mutate input and parsed results are independently owned", () => {
  const original = course();
  const before = structuredClone(original);
  exportScheduleBackup([original], new Date("2026-07-28T00:00:00.000Z"));
  assert.deepEqual(original, before);
  const json = exportScheduleBackup([original], new Date(UPDATED_AT));
  const first = parseScheduleBackup(json);
  first.courses[0]!.code = "MUTATED";
  first.courses[0]!.meetings[0]!.days.push(7);
  const second = parseScheduleBackup(json);
  assert.deepEqual(second.courses, [original]);
  assert.notStrictEqual(first.courses[0], second.courses[0]);
  assert.notStrictEqual(
    first.courses[0]!.meetings[0],
    second.courses[0]!.meetings[0],
  );
});
