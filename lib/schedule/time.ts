import type { IsoWeekday, ScheduleCourse, ScheduleMeeting } from "./types";

export const DAY_LABELS: Readonly<Record<IsoWeekday, string>> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

export const DAY_SHORT_LABELS: Readonly<Record<IsoWeekday, string>> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

export function formatWeekdays(days: readonly IsoWeekday[]): string {
  return days.map((day) => DAY_SHORT_LABELS[day]).join(", ");
}

export function formatMinuteOfDay(minute: number): string {
  if (!Number.isInteger(minute) || minute < 0 || minute > 1440) {
    throw new RangeError("Minute of day must be an integer from 0 through 1440.");
  }
  const normalized = minute % 1440;
  const hour = Math.floor(normalized / 60);
  const displayHour = hour % 12 || 12;
  const minutePart = String(normalized % 60).padStart(2, "0");
  return `${displayHour}:${minutePart} ${hour < 12 ? "AM" : "PM"}`;
}

export interface ManilaWeekPosition {
  weekday: IsoWeekday;
  minuteOfDay: number;
}

const MANILA_POSITION_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const MANILA_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const WEEKDAY_FROM_LABEL: Record<string, IsoWeekday> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function getManilaWeekPosition(now: Date): ManilaWeekPosition {
  if (!Number.isFinite(now.getTime())) throw new RangeError("Date must be valid.");
  const parts = MANILA_POSITION_FORMATTER.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;
  const weekday = WEEKDAY_FROM_LABEL[part("weekday") ?? ""];
  const hour = Number(part("hour"));
  const minute = Number(part("minute"));
  if (!weekday || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error("Unable to calculate Manila schedule time.");
  }
  return { weekday, minuteOfDay: hour * 60 + minute };
}

export function formatManilaCivilDate(now: Date): string {
  if (!Number.isFinite(now.getTime())) throw new RangeError("Date must be valid.");
  const parts = MANILA_DATE_FORMATTER.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) {
    throw new Error("Unable to calculate the Manila calendar date.");
  }
  return `${year}-${month}-${day}`;
}

export interface NextClassOccurrence {
  course: ScheduleCourse;
  meeting: ScheduleMeeting;
  dayOffset: number;
  weekday: IsoWeekday;
  startMinute: number;
  endMinute: number;
  isActive: boolean;
}

export function isMeetingTba(meeting: ScheduleMeeting): boolean {
  if (meeting.facilityId) return false;
  const locationLabel = meeting.locationLabel?.trim();
  return !locationLabel || locationLabel.toLowerCase() === "tba";
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function getNextClassOccurrence(
  courses: readonly ScheduleCourse[],
  now: Date,
): NextClassOccurrence | undefined {
  const current = getManilaWeekPosition(now);
  const candidates: NextClassOccurrence[] = [];

  for (const course of courses) {
    for (const meeting of course.meetings) {
      if (isMeetingTba(meeting)) continue;
      for (const weekday of meeting.days) {
        const baseOffset = (weekday - current.weekday + 7) % 7;
        const isActive =
          baseOffset === 0 &&
          meeting.startMinute <= current.minuteOfDay &&
          current.minuteOfDay < meeting.endMinute;
        let dayOffset = baseOffset;
        if (
          dayOffset === 0 &&
          !isActive &&
          meeting.startMinute <= current.minuteOfDay
        ) {
          dayOffset = 7;
        }
        candidates.push({
          course,
          meeting,
          dayOffset,
          weekday,
          startMinute: meeting.startMinute,
          endMinute: meeting.endMinute,
          isActive,
        });
      }
    }
  }

  return candidates.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
    if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
    const courseOrder = compareText(a.course.code, b.course.code);
    if (courseOrder !== 0) return courseOrder;
    const courseIdOrder = compareText(a.course.id, b.course.id);
    if (courseIdOrder !== 0) return courseIdOrder;
    const meetingIdOrder = compareText(a.meeting.id, b.meeting.id);
    if (meetingIdOrder !== 0) return meetingIdOrder;
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return a.endMinute - b.endMinute;
  })[0];
}
