import type { ScheduleCourse } from "./types";
import {
  ScheduleValidationError,
  isValidScheduleId,
  parseStoredScheduleCourse,
} from "./validation";

export const MAX_SCHEDULE_BACKUP_BYTES = 4 * 1024 * 1024;
export const MAX_SCHEDULE_BACKUP_COURSES = 200;

export interface ScheduleBackupDocument {
  version: 1;
  exportedAt: string;
  courses: ScheduleCourse[];
}

export class ScheduleBackupError extends Error {
  readonly code:
    | "invalid_type"
    | "too_large"
    | "malformed"
    | "unsupported_version"
    | "invalid_document"
    | "too_many_courses"
    | "invalid_course";

  constructor(code: ScheduleBackupError["code"], message: string) {
    super(message);
    this.name = "ScheduleBackupError";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const COURSE_KEYS = new Set([
  "id",
  "code",
  "title",
  "instructor",
  "notes",
  "color",
  "meetings",
  "createdAt",
  "updatedAt",
]);
const MEETING_KEYS = new Set([
  "id",
  "days",
  "startMinute",
  "endMinute",
  "facilityId",
  "locationLabel",
]);

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function safeUuid(
  uuid: () => string,
  unavailable: ReadonlySet<string>,
): string {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const candidate = uuid();
    if (isValidScheduleId(candidate)) {
      const normalized = candidate.trim().toLowerCase();
      if (!unavailable.has(normalized)) return normalized;
    }
  }
  throw new ScheduleBackupError(
    "invalid_course",
    "Unable to assign unique identifiers to the imported schedule.",
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function exportScheduleBackup(
  courses: readonly ScheduleCourse[],
  exportedAt = new Date(),
): string {
  if (courses.length > MAX_SCHEDULE_BACKUP_COURSES) {
    throw new ScheduleBackupError(
      "too_many_courses",
      "The schedule contains too many courses to export.",
    );
  }
  if (!Number.isFinite(exportedAt.getTime())) {
    throw new ScheduleBackupError(
      "invalid_document",
      "The export date is invalid.",
    );
  }
  const exportedAtTimestamp = exportedAt.toISOString();
  let validated: ScheduleCourse[];
  try {
    validated = courses.map((course) => parseStoredScheduleCourse(course));
  } catch {
    throw new ScheduleBackupError(
      "invalid_course",
      "The schedule contains a course that cannot be exported.",
    );
  }
  const courseIds = new Set<string>();
  for (const course of validated) {
    if (courseIds.has(course.id)) {
      throw new ScheduleBackupError(
        "invalid_course",
        "Each exported course must have a unique identifier.",
      );
    }
    courseIds.add(course.id);
  }
  const serialized = `${JSON.stringify(
    { version: 1, exportedAt: exportedAtTimestamp, courses: validated },
    null,
    2,
  )}\n`;
  if (
    new TextEncoder().encode(serialized).byteLength >
    MAX_SCHEDULE_BACKUP_BYTES
  ) {
    throw new ScheduleBackupError(
      "too_large",
      "The schedule backup is too large.",
    );
  }
  return serialized;
}

export function parseScheduleBackup(
  input: string,
  uuid: () => string = () => crypto.randomUUID(),
): ScheduleBackupDocument {
  if (typeof input !== "string") {
    throw new ScheduleBackupError(
      "invalid_type",
      "Choose a valid schedule backup file.",
    );
  }
  if (input.length > MAX_SCHEDULE_BACKUP_BYTES) {
    throw new ScheduleBackupError(
      "too_large",
      "The schedule backup is too large.",
    );
  }
  if (new TextEncoder().encode(input).byteLength > MAX_SCHEDULE_BACKUP_BYTES) {
    throw new ScheduleBackupError(
      "too_large",
      "The schedule backup is too large.",
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new ScheduleBackupError(
      "malformed",
      "The schedule backup is not valid JSON.",
    );
  }
  if (!isRecord(raw)) {
    throw new ScheduleBackupError(
      "invalid_document",
      "The schedule backup is invalid.",
    );
  }
  if (
    Object.keys(raw).sort().join(",") !==
    ["courses", "exportedAt", "version"].join(",")
  ) {
    throw new ScheduleBackupError(
      "invalid_document",
      "The schedule backup is invalid.",
    );
  }
  if (raw.version !== 1) {
    throw new ScheduleBackupError(
      "unsupported_version",
      "This schedule backup version is not supported.",
    );
  }
  if (!isIsoTimestamp(raw.exportedAt) || !Array.isArray(raw.courses)) {
    throw new ScheduleBackupError(
      "invalid_document",
      "The schedule backup is invalid.",
    );
  }
  if (raw.courses.length > MAX_SCHEDULE_BACKUP_COURSES) {
    throw new ScheduleBackupError(
      "too_many_courses",
      "The schedule backup contains too many courses.",
    );
  }

  try {
    const originalCourseIds = new Set<string>();
    const allOriginalIds = new Set<string>();
    try {
      for (const rawCourse of raw.courses) {
        if (
          !isRecord(rawCourse) ||
          !hasOnlyKeys(rawCourse, COURSE_KEYS) ||
          !isValidScheduleId(rawCourse.id)
        ) {
          throw new Error("invalid");
        }
        const courseId = rawCourse.id.trim().toLowerCase();
        allOriginalIds.add(courseId);
        if (!Array.isArray(rawCourse.meetings)) throw new Error("invalid");
        for (const meeting of rawCourse.meetings) {
          if (
            !isRecord(meeting) ||
            !hasOnlyKeys(meeting, MEETING_KEYS) ||
            !isValidScheduleId(meeting.id)
          ) {
            throw new Error("invalid");
          }
          allOriginalIds.add(meeting.id.trim().toLowerCase());
        }
      }
    } catch {
      throw new ScheduleBackupError(
        "invalid_course",
        "The schedule backup contains an invalid course.",
      );
    }

    const usedGeneratedIds = new Set<string>();
    const unavailable = () => new Set([...allOriginalIds, ...usedGeneratedIds]);
    const prepared = raw.courses.map((rawCourse) => {
      const cloned = structuredClone(rawCourse) as Record<string, unknown>;
      const courseId = (cloned.id as string).trim().toLowerCase();
      if (originalCourseIds.has(courseId)) {
        cloned.id = safeUuid(uuid, unavailable());
        usedGeneratedIds.add(cloned.id as string);
      } else {
        originalCourseIds.add(courseId);
      }

      const meetingIds = new Set<string>();
      cloned.meetings = (cloned.meetings as Record<string, unknown>[]).map(
        (meeting) => {
          const meetingClone = { ...meeting };
          const meetingId = (meetingClone.id as string).trim().toLowerCase();
          if (meetingIds.has(meetingId)) {
            meetingClone.id = safeUuid(uuid, unavailable());
            usedGeneratedIds.add(meetingClone.id as string);
          } else {
            meetingIds.add(meetingId);
          }
          return meetingClone;
        },
      );
      return cloned;
    });

    try {
      const courses = prepared.map((course) => {
        const parsed = parseStoredScheduleCourse(course);
        if (canonicalJson(parsed) !== canonicalJson(course)) {
          throw new ScheduleValidationError([
            { field: "course", message: "This saved course is not canonical." },
          ]);
        }
        return parsed;
      });
      return { version: 1, exportedAt: raw.exportedAt, courses };
    } catch (error) {
      if (error instanceof ScheduleBackupError) throw error;
      if (error instanceof ScheduleValidationError) {
        throw new ScheduleBackupError(
          "invalid_course",
          "The schedule backup contains an invalid course.",
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof ScheduleBackupError) throw error;
    throw new ScheduleBackupError(
      "invalid_course",
      "The schedule backup contains an invalid course.",
    );
  }
}
