import assert from "node:assert/strict";
import test from "node:test";

import { exportScheduleIcs } from "./ics";
import type { ScheduleCourse, ScheduleMeeting } from "./types";

const BASE: ScheduleCourse = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  code: "CS,101",
  title: "Intro; Computing",
  instructor: "Ada\\Lovelace",
  notes: "Line one\nLine two",
  color: "blue" as const,
  meetings: [{
    id: "123e4567-e89b-42d3-a456-426614174001",
    days: [1, 3],
    startMinute: 8 * 60,
    endMinute: 9 * 60 + 30,
    locationLabel: "Room, 1",
  }],
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
};
const OPTIONS = {
  termStart: "2026-07-28",
  termEnd: "2026-08-10",
  generatedAt: new Date("2026-07-28T01:02:03.000Z"),
};

test("emits required calendar, Manila timezone, recurrence, and term fields", () => {
  const ics = exportScheduleIcs([BASE], OPTIONS);
  const unfolded = ics.replaceAll("\r\n ", "");
  assert.match(ics, /BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:/);
  assert.match(ics, /CALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-TIMEZONE:Asia\/Manila/);
  assert.match(ics, /BEGIN:VTIMEZONE\r\nTZID:Asia\/Manila/);
  assert.match(ics, /TZOFFSETFROM:\+0800\r\nTZOFFSETTO:\+0800/);
  assert.match(ics, /DTSTAMP:20260728T010203Z/);
  assert.match(ics, /DTSTART;TZID=Asia\/Manila:20260729T080000/);
  assert.match(ics, /DTEND;TZID=Asia\/Manila:20260729T093000/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20260810T155959Z/);
  assert.match(
    unfolded,
    /UID:123e4567-e89b-42d3-a456-426614174000-123e4567-e89b-42d3-a456-426614174001@vsu-smartmap/,
  );
});

test("formats DTSTAMP at whole UTC seconds", () => {
  const ics = exportScheduleIcs([BASE], {
    ...OPTIONS,
    generatedAt: new Date("2026-07-28T01:02:03.987Z"),
  });
  assert.match(ics, /DTSTAMP:20260728T010203Z/);
  assert.doesNotMatch(ics, /DTSTAMP:[^\r\n]*\./);
});

test("accepts four-digit DTSTAMP boundary years and rejects unsafe years", () => {
  for (const generatedAt of [
    new Date("1970-01-01T00:00:00.000Z"),
    new Date("9999-12-31T23:59:59.999Z"),
  ]) {
    assert.doesNotThrow(() =>
      exportScheduleIcs([BASE], { ...OPTIONS, generatedAt }),
    );
  }
  for (const generatedAt of [
    new Date("1969-12-31T23:59:59.999Z"),
    new Date("+010000-01-01T00:00:00.000Z"),
  ]) {
    assert.throws(
      () => exportScheduleIcs([BASE], { ...OPTIONS, generatedAt }),
      RangeError,
    );
  }
});

test("rolls a 1440 end minute to midnight on the next civil date", () => {
  const course: ScheduleCourse = {
    ...BASE,
    meetings: [{ ...BASE.meetings[0], days: [4], endMinute: 1440 }],
  };
  const ics = exportScheduleIcs([course], {
    termStart: "2026-12-31",
    termEnd: "2026-12-31",
    generatedAt: OPTIONS.generatedAt,
  });
  assert.match(ics, /DTSTART;TZID=Asia\/Manila:20261231T080000/);
  assert.match(ics, /DTEND;TZID=Asia\/Manila:20270101T000000/);
  assert.doesNotMatch(ics, /T240000/);
});

test("escapes TEXT values", () => {
  const ics = exportScheduleIcs([BASE], OPTIONS);
  assert.match(ics, /SUMMARY:CS\\,101 - Intro\\; Computing/);
  assert.match(ics, /DESCRIPTION:Instructor: Ada\\\\Lovelace\\nNotes: Line one\\nLine two/);
  assert.match(ics, /LOCATION:Room\\, 1/);
});

test("sanitizes controls and ill-formed UTF-16 across ICS text fields", () => {
  const dirty = "\u0000\u0007\u007f\uD800😀";
  const ics = exportScheduleIcs([{
    ...BASE,
    code: `C${dirty}`,
    title: `T${dirty}`,
    instructor: `I${dirty}`,
    notes: `N${dirty}`,
    meetings: [{ ...BASE.meetings[0], locationLabel: `L${dirty}` }],
  }], OPTIONS);
  assert.equal(/[\u0000\u0007\u007f\uD800]/u.test(ics), false);
  assert.match(ics, /SUMMARY:C����😀 - T����😀/);
  assert.match(ics, /DESCRIPTION:Instructor: I����😀\\nNotes: N����😀/);
  assert.match(ics, /LOCATION:L����😀/);
});

test("omits canonical TBA meetings but includes facility-backed meetings", () => {
  const meetings: ScheduleMeeting[] = [
    { ...BASE.meetings[0], id: "123e4567-e89b-42d3-a456-426614174002", locationLabel: "TBA" },
    { ...BASE.meetings[0], id: "123e4567-e89b-42d3-a456-426614174003", locationLabel: undefined },
    {
      ...BASE.meetings[0],
      id: "123e4567-e89b-42d3-a456-426614174004",
      locationLabel: undefined,
      facilityId: "123e4567-e89b-42d3-a456-426614174005",
    },
  ];
  const ics = exportScheduleIcs([{ ...BASE, meetings }], OPTIONS);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 1);
  assert.match(ics, /LOCATION:Campus facility/);
});

test("sorts events stably independent of input order", () => {
  const second: ScheduleCourse = {
    ...BASE,
    id: "123e4567-e89b-42d3-a456-426614174020",
    code: "AA",
    meetings: [{ ...BASE.meetings[0], id: "123e4567-e89b-42d3-a456-426614174021", days: [2] }],
  };
  assert.equal(
    exportScheduleIcs([BASE, second], OPTIONS),
    exportScheduleIcs([second, BASE], OPTIONS),
  );
});

test("uses unique deterministic UIDs when courses reuse a meeting ID", () => {
  const second = {
    ...BASE,
    id: "123e4567-e89b-42d3-a456-426614174020",
    code: "AA",
  };
  const uids = exportScheduleIcs([BASE, second], OPTIONS)
    .replaceAll("\r\n ", "")
    .split("\r\n")
    .filter((line) => line.startsWith("UID:"));
  assert.equal(new Set(uids).size, 2);
});

test("folds Unicode lines to at most 75 UTF-8 octets without splitting code points", () => {
  const ics = exportScheduleIcs([{
    ...BASE,
    meetings: [{ ...BASE.meetings[0], locationLabel: "😀".repeat(60) }],
  }], OPTIONS);
  for (const line of ics.split("\r\n")) {
    assert.ok(Buffer.byteLength(line, "utf8") <= 75, `${Buffer.byteLength(line)}: ${line}`);
    assert.equal(line.includes("\uFFFD"), false);
  }
  assert.match(ics, /\r\n /);
});

test("uses CRLF only and includes a final CRLF", () => {
  const ics = exportScheduleIcs([BASE], OPTIONS);
  assert.equal(ics.endsWith("\r\n"), true);
  assert.equal(ics.replaceAll("\r\n", "").includes("\n"), false);
});

test("validates Gregorian term dates, ordering, and maximum range", () => {
  for (const options of [
    { termStart: "2026-02-29", termEnd: "2026-03-01", generatedAt: OPTIONS.generatedAt },
    { termStart: "2026-7-01", termEnd: "2026-08-01", generatedAt: OPTIONS.generatedAt },
    { termStart: "2026-08-01", termEnd: "2026-07-01", generatedAt: OPTIONS.generatedAt },
    { termStart: "2026-01-01", termEnd: "2027-01-07", generatedAt: OPTIONS.generatedAt },
  ]) {
    assert.throws(() => exportScheduleIcs([BASE], options), RangeError);
  }
  assert.doesNotThrow(() => exportScheduleIcs([BASE], {
    termStart: "2026-01-01", termEnd: "2027-01-06", generatedAt: OPTIONS.generatedAt,
  }));
});

test("accepts rollover-safe term years and rejects unsupported years", () => {
  assert.doesNotThrow(() => exportScheduleIcs([BASE], {
    termStart: "1970-01-01",
    termEnd: "1970-01-01",
    generatedAt: OPTIONS.generatedAt,
  }));
  const rollover = exportScheduleIcs([{
    ...BASE,
    meetings: [{ ...BASE.meetings[0], days: [4], endMinute: 1440 }],
  }], {
    termStart: "9998-12-31",
    termEnd: "9998-12-31",
    generatedAt: OPTIONS.generatedAt,
  });
  assert.match(rollover, /DTEND;TZID=Asia\/Manila:99990101T000000/);
  for (const year of ["1969", "9999"]) {
    assert.throws(() => exportScheduleIcs([BASE], {
      termStart: `${year}-01-01`,
      termEnd: `${year}-01-01`,
      generatedAt: OPTIONS.generatedAt,
    }), RangeError);
  }
});
