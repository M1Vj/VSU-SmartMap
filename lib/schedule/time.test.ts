import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";

import {
  DAY_LABELS,
  formatManilaCivilDate,
  formatMinuteOfDay,
  formatWeekdays,
  getManilaWeekPosition,
  getNextClassOccurrence,
  isMeetingTba,
} from "./time";
import type { ScheduleCourse, ScheduleMeeting } from "./types";

function meeting(id: string, days: ScheduleMeeting["days"], startMinute: number, endMinute: number): ScheduleMeeting {
  return { id, days, startMinute, endMinute, locationLabel: "Room 101" };
}

function course(code: string, meetings: ScheduleMeeting[]): ScheduleCourse {
  return {
    id: `course-${code}`,
    code,
    title: code,
    color: "blue",
    meetings,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

test("formats civil minutes and weekday labels", () => {
  assert.equal(formatMinuteOfDay(0), "12:00 AM");
  assert.equal(formatMinuteOfDay(12 * 60), "12:00 PM");
  assert.equal(formatMinuteOfDay(13 * 60 + 5), "1:05 PM");
  assert.equal(formatMinuteOfDay(1440), "12:00 AM");
  assert.equal(DAY_LABELS[1], "Monday");
  assert.equal(formatWeekdays([1, 3, 5]), "Mon, Wed, Fri");
});

test("gets Manila weekday and minute across a UTC date boundary", () => {
  assert.deepEqual(getManilaWeekPosition(new Date("2026-07-27T16:30:00.000Z")), {
    weekday: 2,
    minuteOfDay: 30,
  });
  assert.deepEqual(getManilaWeekPosition(new Date("2026-07-26T16:15:00.000Z")), {
    weekday: 1,
    minuteOfDay: 15,
  });
});

test("formats the Manila civil date across the UTC date boundary", () => {
  assert.equal(
    formatManilaCivilDate(new Date("2026-07-28T16:30:00.000Z")),
    "2026-07-29",
  );
  assert.equal(
    formatManilaCivilDate(new Date("2026-07-28T15:59:59.999Z")),
    "2026-07-28",
  );
  assert.throws(
    () => formatManilaCivilDate(new Date(Number.NaN)),
    /valid/,
  );
});

test("returns an active class before future classes", () => {
  const active = course("B", [meeting("active", [2], 0, 60)]);
  const future = course("A", [meeting("future", [2], 45, 90)]);
  const result = getNextClassOccurrence([future, active], new Date("2026-07-27T16:30:00.000Z"));
  assert.equal(result?.meeting.id, "active");
  assert.equal(result?.isActive, true);
  assert.equal(result?.dayOffset, 0);
});

test("returns the nearest later class today", () => {
  const result = getNextClassOccurrence(
    [
      course("FIRST", [meeting("tomorrow", [3], 1, 30)]),
      course("LATE", [meeting("later-late", [2], 180, 240)]),
      course("NEAREST", [meeting("later", [2], 60, 120)]),
    ],
    new Date("2026-07-27T16:30:00.000Z"),
  );
  assert.equal(result?.meeting.id, "later");
  assert.equal(result?.weekday, 2);
  assert.equal(result?.startMinute, 60);
  assert.equal(result?.endMinute, 120);
  assert.equal(result?.isActive, false);
});

test("wraps to the next week within seven days", () => {
  const result = getNextClassOccurrence(
    [course("A", [meeting("next-monday", [1], 0, 30)])],
    new Date("2026-07-27T16:30:00.000Z"),
  );
  assert.equal(result?.dayOffset, 6);
  assert.equal(result?.weekday, 1);
});

test("breaks occurrence ties by course code then meeting ID", () => {
  const result = getNextClassOccurrence(
    [
      course("B", [meeting("b", [2], 60, 120)]),
      course("A", [meeting("z", [2], 60, 120), meeting("a", [2], 60, 120)]),
    ],
    new Date("2026-07-27T16:30:00.000Z"),
  );
  assert.equal(result?.course.code, "A");
  assert.equal(result?.meeting.id, "a");
});

test("breaks otherwise identical ties by course ID independent of input order", () => {
  const higherId = {
    ...course("SAME", [meeting("same", [2], 60, 120)]),
    id: "course-z",
  };
  const lowerId = {
    ...course("SAME", [meeting("same", [2], 60, 120)]),
    id: "course-a",
  };
  const now = new Date("2026-07-27T16:30:00.000Z");
  assert.equal(getNextClassOccurrence([higherId, lowerId], now)?.course.id, "course-a");
  assert.equal(getNextClassOccurrence([lowerId, higherId], now)?.course.id, "course-a");
});

test("returns undefined for an empty schedule", () => {
  assert.equal(getNextClassOccurrence([], new Date("2026-07-27T16:30:00.000Z")), undefined);
});

test("classifies TBA from literal labels or absent meaningful locations", () => {
  const base = meeting("m", [1], 60, 120);
  assert.equal(isMeetingTba({ ...base, locationLabel: "  tBa  " }), true);
  assert.equal(isMeetingTba({ ...base, locationLabel: undefined }), true);
  assert.equal(
    isMeetingTba({ ...base, locationLabel: undefined, facilityId: "facility" }),
    false,
  );
  assert.equal(isMeetingTba({ ...base, locationLabel: "Open Field" }), false);
  assert.equal(
    isMeetingTba({
      ...base,
      facilityId: "123e4567-e89b-42d3-a456-426614174000",
      locationLabel: "TBA",
    }),
    false,
  );
});

test("excludes TBA occurrences while retaining facility-only and free-text classes", () => {
  const now = new Date("2026-07-27T16:30:00.000Z");
  const tba = {
    ...meeting("tba", [2], 40, 50),
    locationLabel: "TBA",
  };
  const absent = {
    ...meeting("absent", [2], 50, 60),
    locationLabel: undefined,
  };
  const facilityOnly = {
    ...meeting("facility", [2], 70, 80),
    locationLabel: undefined,
    facilityId: "facility",
  };
  const freeText = meeting("free-text", [2], 80, 90);
  const result = getNextClassOccurrence(
    [course("A", [tba, absent, freeText, facilityOnly])],
    now,
  );
  assert.equal(result?.meeting.id, "facility");
});

test("returns undefined when every occurrence is TBA", () => {
  const tba = { ...meeting("tba", [2], 60, 120), locationLabel: "TBA" };
  const absent = {
    ...meeting("absent", [2], 60, 120),
    locationLabel: undefined,
  };
  assert.equal(
    getNextClassOccurrence(
      [course("A", [tba, absent])],
      new Date("2026-07-27T16:30:00.000Z"),
    ),
    undefined,
  );
});

test("includes a facility-backed class whose room detail is TBA", () => {
  const facilityBacked = {
    ...meeting("facility-tba", [2], 60, 120),
    facilityId: "123e4567-e89b-42d3-a456-426614174000",
    locationLabel: "TBA",
  };
  const result = getNextClassOccurrence(
    [course("A", [facilityBacked])],
    new Date("2026-07-27T16:30:00.000Z"),
  );
  assert.equal(result?.meeting.id, "facility-tba");
});

test("calculates Manila time independently of the child process device timezone", () => {
  const timeModuleUrl = new URL("./time.ts", import.meta.url).href;
  const tsxImportPath = createRequire(import.meta.url).resolve("tsx");
  const script = `
    import timeModule from ${JSON.stringify(timeModuleUrl)};
    process.stdout.write(JSON.stringify(
      timeModule.getManilaWeekPosition(new Date("2026-07-27T16:30:00.000Z"))
    ));
  `;
  const child = spawnSync(
    process.execPath,
    ["--import", tsxImportPath, "--input-type=module", "--eval", script],
    {
      cwd: "/tmp",
      env: { ...process.env, TZ: "America/New_York" },
      encoding: "utf8",
    },
  );

  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), { weekday: 2, minuteOfDay: 30 });
});
