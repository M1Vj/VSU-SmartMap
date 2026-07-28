import assert from "node:assert/strict";
import test from "node:test";

import { findScheduleConflicts, meetingsOverlap } from "./conflicts";
import type { ScheduleCourse, ScheduleMeeting } from "./types";

function meeting(id: string, days: ScheduleMeeting["days"], startMinute: number, endMinute: number): ScheduleMeeting {
  return { id, days, startMinute, endMinute };
}

function course(id: string, code: string, meetings: ScheduleMeeting[]): ScheduleCourse {
  return {
    id,
    code,
    title: code,
    color: "blue",
    meetings,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

test("detects containment and identical strict overlaps", () => {
  assert.equal(meetingsOverlap(meeting("a", [1], 480, 600), meeting("b", [1], 500, 550)), true);
  assert.equal(meetingsOverlap(meeting("a", [1], 480, 600), meeting("b", [1], 480, 600)), true);
});

test("does not treat adjacency or different weekdays as overlaps", () => {
  assert.equal(meetingsOverlap(meeting("a", [1], 480, 540), meeting("b", [1], 540, 600)), false);
  assert.equal(meetingsOverlap(meeting("a", [1], 480, 600), meeting("b", [2], 500, 550)), false);
});

test("matches any shared weekday in multi-day meetings", () => {
  assert.equal(meetingsOverlap(meeting("a", [1, 3], 480, 600), meeting("b", [2, 3], 500, 550)), true);
});

test("returns stable unique cross-course meeting pairs without self comparisons", () => {
  const a = course("course-a", "A", [
    meeting("a1", [1], 480, 600),
    meeting("a2", [1], 480, 600),
  ]);
  const b = course("course-b", "B", [
    { ...meeting("b1", [1], 500, 550), locationLabel: undefined },
  ]);

  const conflicts = findScheduleConflicts([a, b]);
  assert.deepEqual(
    conflicts.map((conflict) => [
      conflict.courseA.id,
      conflict.meetingA.id,
      conflict.courseB.id,
      conflict.meetingB.id,
    ]),
    [
      ["course-a", "a1", "course-b", "b1"],
      ["course-a", "a2", "course-b", "b1"],
    ],
  );
});

test("TBA-labeled meetings still conflict by weekday and time", () => {
  const a = course("course-a", "A", [
    { ...meeting("a1", [1], 480, 600), locationLabel: "TBA" },
  ]);
  const b = course("course-b", "B", [
    { ...meeting("b1", [1], 500, 550), locationLabel: "TBA" },
  ]);
  assert.equal(findScheduleConflicts([a, b]).length, 1);
});

test("excludes repeated course IDs and deduplicates repeated logical pairs", () => {
  const a = course("course-a", "A", [meeting("a1", [1], 480, 600)]);
  const duplicateA = course("course-a", "A duplicate", [
    meeting("a1", [1], 480, 600),
  ]);
  const b = course("course-b", "B", [
    meeting("b1", [1], 500, 550),
    meeting("b1", [1], 500, 550),
  ]);

  const conflicts = findScheduleConflicts([a, duplicateA, b, a]);
  assert.deepEqual(
    conflicts.map((conflict) => [
      conflict.courseA.id,
      conflict.meetingA.id,
      conflict.courseB.id,
      conflict.meetingB.id,
    ]),
    [["course-a", "a1", "course-b", "b1"]],
  );
});

test("canonicalizes and sorts conflicts independently of caller order", () => {
  const a = course("course-z", "A", [
    meeting("meeting-z", [1], 480, 600),
    meeting("meeting-a", [1], 480, 600),
  ]);
  const b = course("course-a", "B", [meeting("meeting-b", [1], 500, 550)]);

  const forward = findScheduleConflicts([a, b]);
  const reverse = findScheduleConflicts([b, a]);
  const summarize = (conflicts: ReturnType<typeof findScheduleConflicts>) =>
    conflicts.map((conflict) => [
      conflict.courseA.id,
      conflict.meetingA.id,
      conflict.courseB.id,
      conflict.meetingB.id,
    ]);

  assert.deepEqual(summarize(forward), summarize(reverse));
  assert.deepEqual(summarize(forward), [
    ["course-a", "meeting-b", "course-z", "meeting-a"],
    ["course-a", "meeting-b", "course-z", "meeting-z"],
  ]);
});
