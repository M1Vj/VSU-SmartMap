import assert from "node:assert/strict";
import test from "node:test";

import {
  SCHEDULE_LIMITS,
  ScheduleValidationError,
  isValidScheduleId,
  normalizeScheduleCourse,
  parseStoredScheduleCourse,
} from "./validation";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const MEETING_UUID = "123e4567-e89b-42d3-a456-426614174001";
const CREATED_AT = "2026-07-01T01:02:03.000Z";

test("validates schedule UUIDs through the shared identifier helper", () => {
  assert.equal(isValidScheduleId(UUID), true);
  assert.equal(isValidScheduleId(`  ${UUID.toUpperCase()}  `), true);
  assert.equal(isValidScheduleId("not-a-uuid"), false);
  assert.equal(isValidScheduleId(undefined), false);
});

function validDraft() {
  return {
    code: "  CS 101  ",
    title: "  Introduction to Computing  ",
    instructor: "  Ada Lovelace  ",
    notes: "  Bring a laptop  ",
    color: "blue" as const,
    meetings: [
      {
        days: [5, 1, 5] as number[],
        startMinute: 8 * 60,
        endMinute: 9 * 60,
        facilityId: `  ${UUID}  `,
        locationLabel: "  Engineering 201  ",
      },
    ],
  };
}

test("normalizes strings, IDs, weekdays, and timestamps", () => {
  const now = new Date("2026-07-28T03:04:05.000Z");
  const result = normalizeScheduleCourse(
    { ...validDraft(), id: UUID, createdAt: CREATED_AT },
    now,
  );

  assert.equal(result.id, UUID);
  assert.equal(result.code, "CS 101");
  assert.equal(result.title, "Introduction to Computing");
  assert.equal(result.instructor, "Ada Lovelace");
  assert.equal(result.notes, "Bring a laptop");
  assert.deepEqual(result.meetings[0]?.days, [1, 5]);
  assert.equal(result.meetings[0]?.facilityId, UUID);
  assert.equal(result.meetings[0]?.locationLabel, "Engineering 201");
  assert.match(result.meetings[0]?.id ?? "", /^[0-9a-f-]{36}$/);
  assert.equal(result.createdAt, CREATED_AT);
  assert.equal(result.updatedAt, now.toISOString());
});

test("generates IDs and permits facility, free-text, and TBA locations", () => {
  const drafts = [
    validDraft(),
    {
      ...validDraft(),
      meetings: [{ days: [2], startMinute: 600, endMinute: 660, locationLabel: "Field" }],
    },
    {
      ...validDraft(),
      meetings: [{ days: [3], startMinute: 600, endMinute: 660 }],
    },
  ];

  for (const draft of drafts) {
    const result = normalizeScheduleCourse(draft);
    assert.match(result.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.match(result.meetings[0]?.id ?? "", /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(new Date(result.createdAt).toISOString(), result.createdAt);
    assert.equal(new Date(result.updatedAt).toISOString(), result.updatedAt);
  }
});

test("accepts all maximum lengths and one through eight meetings", () => {
  const meeting = {
    days: [1],
    startMinute: 0,
    endMinute: 1440,
    locationLabel: "L".repeat(SCHEDULE_LIMITS.location),
  };
  const result = normalizeScheduleCourse({
    code: "c".repeat(SCHEDULE_LIMITS.code),
    title: "t".repeat(SCHEDULE_LIMITS.title),
    instructor: "i".repeat(SCHEDULE_LIMITS.instructor),
    notes: "n".repeat(SCHEDULE_LIMITS.notes),
    color: "green",
    meetings: Array.from({ length: SCHEDULE_LIMITS.meetingsMax }, () => meeting),
  });
  assert.equal(result.meetings.length, 8);
  assert.equal(result.meetings[0]?.locationLabel?.length, 160);
});

test("preserves a literal trimmed TBA location label", () => {
  const result = normalizeScheduleCourse({
    ...validDraft(),
    meetings: [{ days: [1], startMinute: 60, endMinute: 120, locationLabel: "  TBA  " }],
  });
  assert.equal(result.meetings[0]?.locationLabel, "TBA");
});

test("rejects blank required strings and over-limit text", () => {
  for (const input of [
    { ...validDraft(), code: "   " },
    { ...validDraft(), title: "\t" },
    { ...validDraft(), code: "x".repeat(SCHEDULE_LIMITS.code + 1) },
    { ...validDraft(), title: "x".repeat(SCHEDULE_LIMITS.title + 1) },
    { ...validDraft(), instructor: "x".repeat(SCHEDULE_LIMITS.instructor + 1) },
    { ...validDraft(), notes: "x".repeat(SCHEDULE_LIMITS.notes + 1) },
    {
      ...validDraft(),
      meetings: [{ days: [1], startMinute: 1, endMinute: 2, locationLabel: "x".repeat(SCHEDULE_LIMITS.location + 1) }],
    },
  ]) {
    assert.throws(() => normalizeScheduleCourse(input), ScheduleValidationError);
  }
});

test("rejects absent meetings, too many meetings, invalid days, and invalid times", () => {
  for (const meetings of [
    [],
    Array.from({ length: 9 }, () => ({ days: [1], startMinute: 60, endMinute: 120 })),
    [{ days: [], startMinute: 60, endMinute: 120 }],
    [{ days: [0], startMinute: 60, endMinute: 120 }],
    [{ days: [8], startMinute: 60, endMinute: 120 }],
    [{ days: [1, 2, 3, 4, 5, 6, 7, 1], startMinute: 60, endMinute: 120 }],
    [{ days: [1.5], startMinute: 60, endMinute: 120 }],
    [{ days: [1], startMinute: -1, endMinute: 120 }],
    [{ days: [1], startMinute: 60, endMinute: 60 }],
    [{ days: [1], startMinute: 121, endMinute: 120 }],
    [{ days: [1], startMinute: 60, endMinute: 1441 }],
  ]) {
    assert.throws(() => normalizeScheduleCourse({ ...validDraft(), meetings }), ScheduleValidationError);
  }
});

test("rejects malformed supplied IDs, timestamps, colors, and non-object input", () => {
  for (const input of [
    null,
    { ...validDraft(), id: "bad" },
    { ...validDraft(), meetings: [{ ...validDraft().meetings[0], id: "bad" }] },
    { ...validDraft(), meetings: [{ ...validDraft().meetings[0], facilityId: "bad" }] },
    { ...validDraft(), createdAt: "not-a-date" },
    { ...validDraft(), updatedAt: "not-a-date" },
    { ...validDraft(), color: "url(javascript:bad)" },
  ]) {
    assert.throws(() => normalizeScheduleCourse(input), ScheduleValidationError);
  }
});

test("reports user-safe typed field issues", () => {
  try {
    normalizeScheduleCourse({ ...validDraft(), code: "", meetings: [] });
    assert.fail("expected validation error");
  } catch (error) {
    assert.ok(error instanceof ScheduleValidationError);
    assert.ok(error.issues.some((issue) => issue.field === "code"));
    assert.ok(error.issues.some((issue) => issue.field === "meetings"));
    assert.ok(error.issues.every((issue) => !issue.message.includes("undefined")));
  }
});

test("keeps supplied valid meeting IDs", () => {
  const result = normalizeScheduleCourse({
    ...validDraft(),
    meetings: [{ ...validDraft().meetings[0], id: MEETING_UUID }],
  });
  assert.equal(result.meetings[0]?.id, MEETING_UUID);
});

test("rejects duplicate meeting IDs within one course", () => {
  assert.throws(
    () =>
      normalizeScheduleCourse({
        ...validDraft(),
        meetings: [
          { ...validDraft().meetings[0], id: MEETING_UUID },
          { ...validDraft().meetings[0], id: MEETING_UUID },
        ],
      }),
    (error) =>
      error instanceof ScheduleValidationError &&
      error.issues.some(
        (issue) =>
          issue.field === "meetings.1.id" &&
          issue.message === "Each meeting must have a unique identifier.",
      ),
  );
});

test("parses a stored course while preserving both stored timestamps", () => {
  const updatedAt = "2026-07-02T03:04:05.000Z";
  const stored = {
    ...validDraft(),
    id: UUID,
    createdAt: CREATED_AT,
    updatedAt,
    meetings: [{ ...validDraft().meetings[0], id: MEETING_UUID }],
  };
  const result = parseStoredScheduleCourse(stored);
  assert.equal(result.createdAt, CREATED_AT);
  assert.equal(result.updatedAt, updatedAt);
});

test("stored parsing rejects absent persisted identifiers and timestamps", () => {
  for (const input of [
    { ...validDraft(), createdAt: CREATED_AT, updatedAt: CREATED_AT },
    {
      ...validDraft(),
      id: UUID,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    },
    {
      ...validDraft(),
      id: UUID,
      createdAt: CREATED_AT,
      meetings: [{ ...validDraft().meetings[0], id: MEETING_UUID }],
    },
  ]) {
    assert.throws(() => parseStoredScheduleCourse(input), ScheduleValidationError);
  }
});
