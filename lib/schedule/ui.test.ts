import assert from "node:assert/strict";
import test from "node:test";
import type { ScheduleCourse } from "./types";
import {
  assignMeetingColumns,
  assertScheduleFileSize,
  endTimeValueToMinute,
  minuteToTimeValue,
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

test("guards oversized restore files before reading", () => {
  assert.doesNotThrow(() => assertScheduleFileSize(4 * 1024 * 1024));
  assert.throws(() => assertScheduleFileSize(4 * 1024 * 1024 + 1), /too large/i);
});
