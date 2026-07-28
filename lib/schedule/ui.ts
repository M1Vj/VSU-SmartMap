import { MAX_SCHEDULE_BACKUP_BYTES } from "./backup";
import { formatMinuteOfDay, isMeetingTba } from "./time";
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

export const MAX_WEEK_GRID_OCCURRENCES = 224;
const ISO_WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

export type WeekGridModel =
  | { kind: "fallback"; occurrenceCount: number }
  | {
      kind: "grid";
      occurrenceCount: number;
      days: Array<{
        day: IsoWeekday;
        conflictMeetingIds: Set<string>;
        blocks: MeetingGridBlock[];
      }>;
    };

export function buildWeekGridModel(
  courses: readonly ScheduleCourse[],
  helpers: {
    analyzeDay?: typeof analyzeDayConflicts;
    layoutDay?: typeof assignMeetingColumns;
  } = {},
): WeekGridModel {
  let occurrenceCount = 0;
  for (const course of courses) {
    for (const meeting of course.meetings) {
      occurrenceCount += meeting.days.length;
    }
  }
  if (occurrenceCount > MAX_WEEK_GRID_OCCURRENCES) {
    return { kind: "fallback", occurrenceCount };
  }
  const analyzeDay = helpers.analyzeDay ?? analyzeDayConflicts;
  const layoutDay = helpers.layoutDay ?? assignMeetingColumns;
  return {
    kind: "grid",
    occurrenceCount,
    days: ISO_WEEKDAYS.map((day) => ({
      day,
      conflictMeetingIds: analyzeDay(courses, day).conflictMeetingIds,
      blocks: layoutDay(courses, day),
    })),
  };
}

export function getMeetingGridPosition(
  startMinute: number,
  endMinute: number,
): {
  topPercent: number;
  heightPercent: number;
  anchor: "top" | "bottom";
  bottomPercent?: number;
} {
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
    anchor: endMinute === 1440 ? "bottom" : "top",
    ...(endMinute === 1440 ? { bottomPercent: 0 } : {}),
  };
}

export interface ScheduleConflictNotice {
  key: string;
  label: string;
}

export interface DayConflictAnalysis {
  conflictMeetingIds: Set<string>;
  totalPairCount: number;
  notices: ScheduleConflictNotice[];
  remainingPairCount: number;
}

const CONFLICT_NOTICE_LIMIT = 100;

export function analyzeDayConflicts(
  courses: readonly ScheduleCourse[],
  day: IsoWeekday,
): DayConflictAnalysis {
  const entries = courses.flatMap((course) =>
    course.meetings
      .filter((meeting) => meeting.days.includes(day))
      .map((meeting) => ({ course, meeting })),
  ).sort(
    (a, b) =>
      a.meeting.startMinute - b.meeting.startMinute ||
      a.meeting.endMinute - b.meeting.endMinute ||
      a.course.id.localeCompare(b.course.id) ||
      a.meeting.id.localeCompare(b.meeting.id),
  );
  const active: typeof entries = [];
  const conflictMeetingIds = new Set<string>();
  const conflictedEntries = new Set<(typeof entries)[number]>();
  const notices: ScheduleConflictNotice[] = [];
  let totalPairCount = 0;
  for (const entry of entries) {
    let write = 0;
    for (const candidate of active) {
      if (candidate.meeting.endMinute > entry.meeting.startMinute) {
        active[write++] = candidate;
        if (candidate.course.id === entry.course.id) continue;
        totalPairCount += 1;
        if (!conflictedEntries.has(candidate)) {
          conflictedEntries.add(candidate);
          conflictMeetingIds.add(
            `${candidate.course.id}:${candidate.meeting.id}`,
          );
        }
        if (!conflictedEntries.has(entry)) {
          conflictedEntries.add(entry);
          conflictMeetingIds.add(`${entry.course.id}:${entry.meeting.id}`);
        }
        if (notices.length < CONFLICT_NOTICE_LIMIT) {
          const start = Math.max(
            candidate.meeting.startMinute,
            entry.meeting.startMinute,
          );
          const end = Math.min(
            candidate.meeting.endMinute,
            entry.meeting.endMinute,
          );
          notices.push({
            key: `${candidate.course.id}:${candidate.meeting.id}:${entry.course.id}:${entry.meeting.id}`,
            label: `${candidate.course.code} conflicts with ${entry.course.code}, ${formatMinuteOfDay(start)}–${formatMinuteOfDay(end)}.`,
          });
        }
      }
    }
    active.length = write;
    active.push(entry);
  }
  return {
    conflictMeetingIds,
    totalPairCount,
    notices,
    remainingPairCount: Math.max(0, totalPairCount - notices.length),
  };
}

export function selectedDayConflictNotices(
  courses: readonly ScheduleCourse[],
  day: IsoWeekday,
): ScheduleConflictNotice[] {
  return analyzeDayConflicts(courses, day).notices;
}

export function getDayAgendaData(
  courses: readonly ScheduleCourse[],
  day: IsoWeekday,
) {
  const entries = courses.flatMap((course) =>
    course.meetings
      .filter((meeting) => meeting.days.includes(day))
      .map((meeting) => ({ course, meeting })),
  ).sort(
    (a, b) =>
      a.meeting.startMinute - b.meeting.startMinute ||
      a.course.code.localeCompare(b.course.code),
  );
  return {
    entries,
    tbaCount: entries.filter(({ meeting }) => isMeetingTba(meeting)).length,
  };
}

export function reconcileKnownFacilityIds(
  cachedIds: readonly string[],
  liveIds: readonly string[] | undefined,
): Set<string> {
  return new Set(liveIds ?? cachedIds);
}

export function getFacilityOptionsStatus({
  source,
  loading,
  error,
  facilityCount,
}: {
  source: "cache" | "remote" | "empty";
  loading: boolean;
  error: string | null;
  facilityCount: number;
}): { message: string; tone: "muted" | "warning" } | null {
  if (error) {
    return facilityCount > 0
      ? {
          message: "Showing saved facilities. Refresh unavailable.",
          tone: "warning",
        }
      : {
          message: "Campus facilities are unavailable right now.",
          tone: "warning",
        };
  }
  if (loading) {
    return source === "cache" && facilityCount > 0
      ? {
          message: "Showing saved facilities while refreshing…",
          tone: "muted",
        }
      : { message: "Loading campus facilities…", tone: "muted" };
  }
  return null;
}

export type RestoreDialogState = "closed" | "transfer" | "confirm";
export type RestoreDialogEvent = "restore-ready" | "cancel" | "confirmed";
export function transitionRestoreDialogs(
  state: RestoreDialogState,
  event: RestoreDialogEvent,
): RestoreDialogState {
  if (state === "transfer" && event === "restore-ready") return "confirm";
  if (state === "confirm" && event === "cancel") return "transfer";
  if (state === "confirm" && event === "confirmed") return "closed";
  return state;
}

export function mapScheduleIssuesToFormErrors(
  issues: readonly ScheduleValidationIssue[],
  locationModes: readonly string[] = [],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    if (issue.field.endsWith(".time")) {
      const prefix = issue.field.slice(0, -".time".length);
      result[`${prefix}.start`] ??= issue.message;
      result[`${prefix}.end`] ??= issue.message;
    } else {
      const locationMatch = /^meetings\.(\d+)\.locationLabel$/.exec(issue.field);
      const field =
        locationMatch &&
        locationModes[Number(locationMatch[1])] === "facility"
          ? `meetings.${locationMatch[1]}.facilityDetail`
          : issue.field;
      result[field] ??= issue.message;
    }
  }
  return result;
}

export function buildFacilityLocationLabel(
  facilityName: string,
  detail: string,
): { label: string; error?: string } {
  const trimmedDetail = detail.trim();
  const label = trimmedDetail
    ? `${facilityName} · ${trimmedDetail}`
    : facilityName;
  return label.length <= 160
    ? { label }
    : { label, error: "Facility and room details must use 160 characters or fewer." };
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
