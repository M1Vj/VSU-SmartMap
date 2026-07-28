import { MAX_SCHEDULE_BACKUP_BYTES } from "./backup";
import type { IsoWeekday, ScheduleCourse, ScheduleMeeting } from "./types";

export function timeValueToMinute(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new RangeError("Choose a valid time.");
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minuteToTimeValue(minute: number): string {
  if (!Number.isInteger(minute) || minute < 0 || minute > 1440) {
    throw new RangeError("Choose a valid time.");
  }
  if (minute === 1440) return "00:00";
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export function endTimeValueToMinute(value: string, startMinute: number): number {
  const endMinute = timeValueToMinute(value);
  return endMinute === 0 && startMinute > 0 ? 1440 : endMinute;
}

export function assertScheduleFileSize(size: number): void {
  if (!Number.isFinite(size) || size < 0 || size > MAX_SCHEDULE_BACKUP_BYTES) {
    throw new RangeError("The schedule backup is too large.");
  }
}

export interface MeetingGridBlock {
  course: ScheduleCourse;
  meeting: ScheduleMeeting;
  column: number;
  columnCount: number;
}

export function assignMeetingColumns(
  courses: readonly ScheduleCourse[],
  day: IsoWeekday,
): MeetingGridBlock[] {
  const entries = courses
    .flatMap((course) =>
      course.meetings
        .filter((meeting) => meeting.days.includes(day))
        .map((meeting) => ({ course, meeting })),
    )
    .sort(
      (a, b) =>
        a.meeting.startMinute - b.meeting.startMinute ||
        a.meeting.endMinute - b.meeting.endMinute ||
        a.course.code.localeCompare(b.course.code) ||
        a.course.id.localeCompare(b.course.id) ||
        a.meeting.id.localeCompare(b.meeting.id),
    );

  const result: MeetingGridBlock[] = [];
  let group: Array<Omit<MeetingGridBlock, "columnCount">> = [];
  let groupEnd = -1;
  const flush = () => {
    if (group.length === 0) return;
    const count = Math.max(...group.map((item) => item.column)) + 1;
    result.push(...group.map((item) => ({ ...item, columnCount: count })));
    group = [];
  };

  for (const entry of entries) {
    if (entry.meeting.startMinute >= groupEnd) {
      flush();
      groupEnd = -1;
    }
    const used = new Set(
      group
        .filter((item) => item.meeting.endMinute > entry.meeting.startMinute)
        .map((item) => item.column),
    );
    let column = 0;
    while (used.has(column)) column += 1;
    group.push({ ...entry, column });
    groupEnd = Math.max(groupEnd, entry.meeting.endMinute);
  }
  flush();
  return result;
}
