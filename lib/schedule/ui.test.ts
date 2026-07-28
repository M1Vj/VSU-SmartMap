import assert from "node:assert/strict";
import test from "node:test";
import type { ScheduleCourse } from "./types";
import {
  assignMeetingColumns,
  assertScheduleFileSize,
  endTimeValueToMinute,
  facilitySelectionError,
  getMeetingGridPosition,
  mapScheduleIssuesToFormErrors,
  minuteToTimeValue,
  selectedDayConflictNotices,
  timeValueToMinute,
} from "./ui";

test("converts HTML time values to integer minutes and back", () => {
  assert.equal(timeValueToMinute("09:05"), 545);
  assert.equal(minuteToTimeValue(545), "09:05");
  assert.equal(minuteToTimeValue(1440), "00:00");
  assert.equal(endTimeValueToMinute("00:00", 1380), 1440);
});

test("rejects invalid HTML time values", () => {
  assert.throws(() => timeValueToMinute("9:05"), /valid time/i);
  assert.throws(() => timeValueToMinute("24:01"), /valid time/i);
});

test("assigns deterministic columns only to strict overlaps", () => {
  const course = (id: string, startMinute: number, endMinute: number): ScheduleCourse => ({
    id,
    code: id,
    title: id,
    color: "blue",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    meetings: [{
      id: `${id}00000-0000-4000-8000-000000000000`.slice(0, 36),
      days: [1],
      startMinute,
      endMinute,
    }],
  });
  const blocks = assignMeetingColumns([
    course("a", 540, 600),
    course("b", 570, 630),
    course("c", 600, 660),
  ], 1);

  assert.deepEqual(
    blocks.map(({ course, column, columnCount }) => [course.code, column, columnCount]),
    [["a", 0, 2], ["b", 1, 2], ["c", 0, 2]],
  );
});

test("positions the full 00:00 through 24:00 meeting domain without clipping", () => {
  const midnight = getMeetingGridPosition(0, 60);
  assert.equal(midnight.topPercent, 0);
  assert.ok(Math.abs(midnight.heightPercent - 100 / 24) < 1e-10);
  const early = getMeetingGridPosition(300, 360);
  assert.ok(Math.abs(early.topPercent - 100 * 5 / 24) < 1e-10);
  const late = getMeetingGridPosition(1380, 1440);
  assert.ok(Math.abs(late.topPercent - 100 * 23 / 24) < 1e-10);
  const fullDay = getMeetingGridPosition(0, 1440);
  assert.equal(fullDay.topPercent + fullDay.heightPercent, 100);
});

test("describes every selected-day multi-way conflict pair once in stable order", () => {
  const course = (id: string): ScheduleCourse => ({
    id,
    code: id.toUpperCase(),
    title: id,
    color: "blue",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    meetings: [{ id: `${id}00000-0000-4000-8000-000000000000`.slice(0, 36), days: [1], startMinute: 540, endMinute: 600 }],
  });
  assert.deepEqual(
    selectedDayConflictNotices([course("a"), course("b"), course("c")], 1).map((notice) => notice.label),
    [
      "A conflicts with B, 9:00 AM–10:00 AM.",
      "A conflicts with C, 9:00 AM–10:00 AM.",
      "B conflicts with C, 9:00 AM–10:00 AM.",
    ],
  );
});

test("maps domain validation issues to actionable form controls", () => {
  assert.deepEqual(mapScheduleIssuesToFormErrors([
    { field: "code", message: "This field is required." },
    { field: "title", message: "Use 120 characters or fewer." },
    { field: "meetings.0.days", message: "Choose at least one weekday." },
    { field: "meetings.0.time", message: "Choose a valid start and end time." },
    { field: "meetings.0.locationLabel", message: "Enter a location." },
    { field: "meetings.1.facilityId", message: "Select a valid facility." },
  ]), {
    code: "This field is required.",
    title: "Use 120 characters or fewer.",
    "meetings.0.days": "Choose at least one weekday.",
    "meetings.0.start": "Choose a valid start and end time.",
    "meetings.0.end": "Choose a valid start and end time.",
    "meetings.0.locationLabel": "Enter a location.",
    "meetings.1.facilityId": "Select a valid facility.",
  });
});

test("requires a selected facility to match the loaded facility options", () => {
  assert.equal(facilitySelectionError("facility", "", ["known"]), "Choose a valid campus facility.");
  assert.equal(facilitySelectionError("facility", "stale", ["known"]), "Choose a valid campus facility.");
  assert.equal(facilitySelectionError("facility", "known", ["known"]), undefined);
  assert.equal(facilitySelectionError("text", "", ["known"]), undefined);
});

test("guards oversized restore files before reading", () => {
  assert.doesNotThrow(() => assertScheduleFileSize(4 * 1024 * 1024));
  assert.throws(() => assertScheduleFileSize(4 * 1024 * 1024 + 1), /too large/i);
});
