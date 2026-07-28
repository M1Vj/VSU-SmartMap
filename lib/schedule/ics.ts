import type { IsoWeekday, ScheduleCourse } from "./types";
import { isMeetingTba } from "./time";
import { parseStoredScheduleCourse } from "./validation";

export interface ScheduleIcsOptions {
  termStart: string;
  termEnd: string;
  generatedAt: Date;
}

const DAY_CODES: Readonly<Record<IsoWeekday, string>> = {
  1: "MO",
  2: "TU",
  3: "WE",
  4: "TH",
  5: "FR",
  6: "SA",
  7: "SU",
};

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Use a valid term date.");
  const [year, month, day] = value.split("-").map(Number);
  if (year! < 1970 || year! > 9998) {
    throw new RangeError("Use a supported term year.");
  }
  const date = new Date(Date.UTC(year!, month! - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month! - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError("Use a valid term date.");
  }
  return date;
}

function compactDate(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function utcTimestamp(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new RangeError("Use a valid generated date.");
  const year = date.getUTCFullYear();
  if (year < 1970 || year > 9999) {
    throw new RangeError("Use a generated date with a four-digit UTC year.");
  }
  return `${date.toISOString().slice(0, 19).replaceAll("-", "").replaceAll(":", "")}Z`;
}

function localTime(minute: number): string {
  const normalized = minute % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}00`;
}

function escapeText(value: string): string {
  let sanitized = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    const isForbiddenControl =
      (codePoint < 0x20 &&
        codePoint !== 0x09 &&
        codePoint !== 0x0a &&
        codePoint !== 0x0d) ||
      codePoint === 0x7f;
    const isLoneSurrogate = codePoint >= 0xd800 && codePoint <= 0xdfff;
    sanitized += isForbiddenControl || isLoneSurrogate ? "\uFFFD" : character;
  }
  return sanitized
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\r", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function foldLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let limit = 75;
  for (const character of line) {
    const next = current + character;
    if (new TextEncoder().encode(next).byteLength > limit) {
      result.push(current);
      current = ` ${character}`;
      limit = 75;
    } else {
      current = next;
    }
  }
  result.push(current);
  return result;
}

function firstMatchingDate(start: Date, days: readonly IsoWeekday[]): Date {
  const startIsoDay = ((start.getUTCDay() + 6) % 7) + 1;
  const offset = Math.min(...days.map((day) => (day - startIsoDay + 7) % 7));
  const result = new Date(start);
  result.setUTCDate(result.getUTCDate() + offset);
  return result;
}

export function exportScheduleIcs(
  courses: readonly ScheduleCourse[],
  options: ScheduleIcsOptions,
): string {
  const start = parseDate(options.termStart);
  const end = parseDate(options.termEnd);
  const durationDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (durationDays < 0 || durationDays > 370) {
    throw new RangeError("The term must span no more than 370 days.");
  }
  const dtstamp = utcTimestamp(options.generatedAt);
  const until = `${compactDate(end)}T155959Z`;
  const validated = courses.map((course) => parseStoredScheduleCourse(course));

  const events = validated
    .flatMap((course) =>
      course.meetings
        .filter((meeting) => !isMeetingTba(meeting))
        .map((meeting) => ({ course, meeting })),
    )
    .sort(
      (a, b) =>
        (a.course.code < b.course.code ? -1 : a.course.code > b.course.code ? 1 : 0) ||
        (a.course.title < b.course.title ? -1 : a.course.title > b.course.title ? 1 : 0) ||
        a.course.id.localeCompare(b.course.id) ||
        a.meeting.id.localeCompare(b.meeting.id),
    );

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VSU SmartMap//Student Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-TIMEZONE:Asia/Manila",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Manila",
    "X-LIC-LOCATION:Asia/Manila",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:PST",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  for (const { course, meeting } of events) {
    const first = firstMatchingDate(start, meeting.days);
    if (first > end) continue;
    const meetingEndDate = new Date(first);
    if (meeting.endMinute === 1440) {
      meetingEndDate.setUTCDate(meetingEndDate.getUTCDate() + 1);
    }
    const description = [
      course.instructor ? `Instructor: ${course.instructor}` : "",
      course.notes ? `Notes: ${course.notes}` : "",
    ].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${course.id}-${meeting.id}@vsu-smartmap`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Asia/Manila:${compactDate(first)}T${localTime(meeting.startMinute)}`,
      `DTEND;TZID=Asia/Manila:${compactDate(meetingEndDate)}T${localTime(meeting.endMinute)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${meeting.days.map((day) => DAY_CODES[day]).join(",")};UNTIL=${until}`,
      `SUMMARY:${escapeText(`${course.code} - ${course.title}`)}`,
      ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
      `LOCATION:${escapeText(meeting.locationLabel?.trim() || "Campus facility")}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.flatMap(foldLine).join("\r\n")}\r\n`;
}
