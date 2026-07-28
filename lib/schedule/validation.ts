import type {
  IsoWeekday,
  ScheduleColor,
  ScheduleCourse,
  ScheduleCourseInput,
  ScheduleMeeting,
  ScheduleMeetingInput,
} from "./types";

export const SCHEDULE_LIMITS = {
  code: 24,
  title: 120,
  instructor: 100,
  notes: 500,
  location: 160,
  meetingsMin: 1,
  meetingsMax: 8,
} as const;

export interface ScheduleValidationIssue {
  field: string;
  message: string;
}

export class ScheduleValidationError extends Error {
  readonly issues: ScheduleValidationIssue[];

  constructor(issues: ScheduleValidationIssue[]) {
    super("Please correct the highlighted schedule fields.");
    this.name = "ScheduleValidationError";
    this.issues = issues;
  }
}

const COLORS: readonly ScheduleColor[] = [
  "blue",
  "green",
  "violet",
  "amber",
  "rose",
  "cyan",
  "slate",
];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedString(
  value: unknown,
  field: string,
  issues: ScheduleValidationIssue[],
  options: { required?: boolean; max: number },
): string | undefined {
  if (value === undefined || value === null) {
    if (options.required) issues.push({ field, message: "This field is required." });
    return undefined;
  }
  if (typeof value !== "string") {
    issues.push({ field, message: "Enter valid text." });
    return undefined;
  }
  const result = value.trim();
  if (!result) {
    if (options.required) issues.push({ field, message: "This field is required." });
    return undefined;
  }
  if (result.length > options.max) {
    issues.push({ field, message: `Use ${options.max} characters or fewer.` });
    return undefined;
  }
  return result;
}

function normalizedUuid(
  value: unknown,
  field: string,
  issues: ScheduleValidationIssue[],
): string {
  if (value === undefined || value === null) return crypto.randomUUID();
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    issues.push({ field, message: "This saved identifier is invalid." });
    return crypto.randomUUID();
  }
  return value.trim().toLowerCase();
}

function optionalUuid(
  value: unknown,
  field: string,
  issues: ScheduleValidationIssue[],
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    issues.push({ field, message: "Select a valid facility." });
    return undefined;
  }
  return value.trim().toLowerCase();
}

function validTimestamp(
  value: unknown,
  field: string,
  issues: ScheduleValidationIssue[],
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    issues.push({ field, message: "This saved date is invalid." });
    return undefined;
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    issues.push({ field, message: "This saved date is invalid." });
    return undefined;
  }
  return value;
}

function normalizeMeeting(
  value: unknown,
  index: number,
  issues: ScheduleValidationIssue[],
): ScheduleMeeting {
  const field = `meetings.${index}`;
  const input: ScheduleMeetingInput = isRecord(value) ? value : {};
  if (!isRecord(value)) issues.push({ field, message: "Enter a valid meeting." });

  const rawDays = input.days;
  let days: IsoWeekday[] = [];
  if (!Array.isArray(rawDays) || rawDays.length === 0) {
    issues.push({ field: `${field}.days`, message: "Choose at least one weekday." });
  } else if (rawDays.length > 7) {
    issues.push({ field: `${field}.days`, message: "Choose no more than seven weekdays." });
  } else if (
    rawDays.some(
      (day) => !Number.isInteger(day) || (day as number) < 1 || (day as number) > 7,
    )
  ) {
    issues.push({ field: `${field}.days`, message: "Choose valid weekdays." });
  } else {
    days = [...new Set(rawDays as IsoWeekday[])].sort((a, b) => a - b);
  }

  const start = input.startMinute;
  const end = input.endMinute;
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    (start as number) < 0 ||
    (end as number) > 1440 ||
    (start as number) >= (end as number)
  ) {
    issues.push({
      field: `${field}.time`,
      message: "Choose a valid start and end time.",
    });
  }

  const locationLabel = normalizedString(
    input.locationLabel,
    `${field}.locationLabel`,
    issues,
    { max: SCHEDULE_LIMITS.location },
  );
  const facilityId = optionalUuid(input.facilityId, `${field}.facilityId`, issues);

  return {
    id: normalizedUuid(input.id, `${field}.id`, issues),
    days,
    startMinute: typeof start === "number" ? start : 0,
    endMinute: typeof end === "number" ? end : 0,
    ...(facilityId ? { facilityId } : {}),
    ...(locationLabel ? { locationLabel } : {}),
  };
}

export function normalizeScheduleCourse(
  value: unknown,
  now = new Date(),
): ScheduleCourse {
  const issues: ScheduleValidationIssue[] = [];
  const input: ScheduleCourseInput = isRecord(value) ? value : {};
  if (!isRecord(value)) {
    issues.push({ field: "course", message: "Enter a valid course." });
  }

  const code = normalizedString(input.code, "code", issues, {
    required: true,
    max: SCHEDULE_LIMITS.code,
  });
  const title = normalizedString(input.title, "title", issues, {
    required: true,
    max: SCHEDULE_LIMITS.title,
  });
  const instructor = normalizedString(input.instructor, "instructor", issues, {
    max: SCHEDULE_LIMITS.instructor,
  });
  const notes = normalizedString(input.notes, "notes", issues, {
    max: SCHEDULE_LIMITS.notes,
  });

  const color =
    typeof input.color === "string" && COLORS.includes(input.color as ScheduleColor)
      ? (input.color as ScheduleColor)
      : undefined;
  if (!color) issues.push({ field: "color", message: "Choose a valid color." });

  const rawMeetings = input.meetings;
  let meetings: ScheduleMeeting[] = [];
  if (
    !Array.isArray(rawMeetings) ||
    rawMeetings.length < SCHEDULE_LIMITS.meetingsMin ||
    rawMeetings.length > SCHEDULE_LIMITS.meetingsMax
  ) {
    issues.push({ field: "meetings", message: "Add between 1 and 8 meetings." });
  } else {
    meetings = rawMeetings.map((meeting, index) =>
      normalizeMeeting(meeting, index, issues),
    );
    const meetingIds = new Set<string>();
    meetings.forEach((meeting, index) => {
      if (meetingIds.has(meeting.id)) {
        issues.push({
          field: `meetings.${index}.id`,
          message: "Each meeting must have a unique identifier.",
        });
      }
      meetingIds.add(meeting.id);
    });
  }

  const id = normalizedUuid(input.id, "id", issues);
  const createdAt = validTimestamp(input.createdAt, "createdAt", issues);
  validTimestamp(input.updatedAt, "updatedAt", issues);

  if (!Number.isFinite(now.getTime())) {
    issues.push({ field: "updatedAt", message: "This saved date is invalid." });
  }
  if (issues.length > 0) throw new ScheduleValidationError(issues);

  const timestamp = now.toISOString();
  return {
    id,
    code: code!,
    title: title!,
    ...(instructor ? { instructor } : {}),
    ...(notes ? { notes } : {}),
    color: color!,
    meetings,
    createdAt: createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

export function parseStoredScheduleCourse(value: unknown): ScheduleCourse {
  const issues: ScheduleValidationIssue[] = [];
  if (!isRecord(value)) {
    throw new ScheduleValidationError([
      { field: "course", message: "This saved course is invalid." },
    ]);
  }
  if (value.id === undefined || value.id === null) {
    issues.push({ field: "id", message: "This saved identifier is required." });
  }
  if (value.createdAt === undefined || value.createdAt === null) {
    issues.push({ field: "createdAt", message: "This saved date is required." });
  }
  if (value.updatedAt === undefined || value.updatedAt === null) {
    issues.push({ field: "updatedAt", message: "This saved date is required." });
  }
  if (Array.isArray(value.meetings)) {
    value.meetings.forEach((meeting, index) => {
      if (!isRecord(meeting) || meeting.id === undefined || meeting.id === null) {
        issues.push({
          field: `meetings.${index}.id`,
          message: "This saved identifier is required.",
        });
      }
    });
  }
  if (issues.length > 0) throw new ScheduleValidationError(issues);

  const updatedAt = validTimestamp(value.updatedAt, "updatedAt", issues);
  if (issues.length > 0 || !updatedAt) throw new ScheduleValidationError(issues);
  return normalizeScheduleCourse(value, new Date(updatedAt));
}
