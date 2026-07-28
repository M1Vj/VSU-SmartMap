import { MAX_SCHEDULE_BACKUP_BYTES } from "./backup";
import { findScheduleConflicts } from "./conflicts";
import { formatMinuteOfDay } from "./time";
import type { IsoWeekday, ScheduleCourse, ScheduleMeeting } from "./types";
import type { ScheduleValidationIssue } from "./validation";

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

export function getMeetingGridPosition(
  startMinute: number,
  endMinute: number,
): { topPercent: number; heightPercent: number } {
  if (
    !Number.isInteger(startMinute) ||
    !Number.isInteger(endMinute) ||
    startMinute < 0 ||
    endMinute > 1440 ||
    startMinute >= endMinute
  ) {
    throw new RangeError("Choose a valid meeting time.");
  }
  return {
    topPercent: (startMinute / 1440) * 100,
    heightPercent: ((endMinute - startMinute) / 1440) * 100,
  };
}

export interface ScheduleConflictNotice {
  key: string;
  label: string;
}

export function selectedDayConflictNotices(
  courses: readonly ScheduleCourse[],
  day: IsoWeekday,
): ScheduleConflictNotice[] {
  return findScheduleConflicts(courses)
    .filter(
      (conflict) =>
        conflict.meetingA.days.includes(day) &&
        conflict.meetingB.days.includes(day),
    )
    .map((conflict) => {
      const start = Math.max(
        conflict.meetingA.startMinute,
        conflict.meetingB.startMinute,
      );
      const end = Math.min(
        conflict.meetingA.endMinute,
        conflict.meetingB.endMinute,
      );
      return {
        key: `${conflict.courseA.id}:${conflict.meetingA.id}:${conflict.courseB.id}:${conflict.meetingB.id}`,
        label: `${conflict.courseA.code} conflicts with ${conflict.courseB.code}, ${formatMinuteOfDay(start)}–${formatMinuteOfDay(end)}.`,
      };
    });
}

export function mapScheduleIssuesToFormErrors(
  issues: readonly ScheduleValidationIssue[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    if (issue.field.endsWith(".time")) {
      const prefix = issue.field.slice(0, -".time".length);
      result[`${prefix}.start`] ??= issue.message;
      result[`${prefix}.end`] ??= issue.message;
    } else {
      result[issue.field] ??= issue.message;
    }
  }
  return result;
}

export function facilitySelectionError(
  mode: string,
  facilityId: string,
  knownFacilityIds: readonly string[],
): string | undefined {
  return mode === "facility" && !knownFacilityIds.includes(facilityId)
    ? "Choose a valid campus facility."
    : undefined;
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
