import { db } from "../db";
import type { ScheduleCourse } from "./types";
import {
  ScheduleValidationError,
  isValidScheduleId,
  normalizeScheduleCourse,
  parseStoredScheduleCourse,
} from "./validation";

export type ScheduleStorageErrorCode =
  | "unavailable"
  | "quota"
  | "corrupt"
  | "unknown";

const STORAGE_MESSAGES: Record<ScheduleStorageErrorCode, string> = {
  unavailable: "Schedule storage is unavailable on this device.",
  quota: "This device does not have enough storage space for the schedule.",
  corrupt: "Saved schedule data could not be read safely.",
  unknown: "The schedule could not be saved or loaded.",
};

export class ScheduleStorageError extends Error {
  readonly code: ScheduleStorageErrorCode;

  constructor(code: ScheduleStorageErrorCode) {
    super(STORAGE_MESSAGES[code]);
    this.name = "ScheduleStorageError";
    this.code = code;
  }
}

export interface ScheduleStore {
  list(): Promise<unknown[]>;
  put(course: ScheduleCourse): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  replaceAll(courses: ScheduleCourse[]): Promise<void>;
}

export type ScheduleStoreFactory = () => ScheduleStore;

const QUOTA_ERROR_NAMES = new Set([
  "QuotaExceededError",
  "NS_ERROR_DOM_QUOTA_REACHED",
]);
const UNAVAILABLE_ERROR_NAMES = new Set([
  "InvalidStateError",
  "SecurityError",
  "DatabaseClosedError",
  "MissingAPIError",
  "OpenFailedError",
]);

function nestedErrorNames(error: unknown): Set<string> {
  const names = new Set<string>();
  const seen = new Set<object>();
  const pending: Array<{ value: unknown; depth: number }> = [
    { value: error, depth: 0 },
  ];

  while (pending.length > 0 && seen.size < 32) {
    const current = pending.shift()!;
    if (
      current.depth > 4 ||
      typeof current.value !== "object" ||
      current.value === null ||
      seen.has(current.value)
    ) {
      continue;
    }
    seen.add(current.value);

    const record = current.value as Record<string, unknown>;
    if (typeof record.name === "string") names.add(record.name);

    if (record.cause !== undefined) {
      pending.push({ value: record.cause, depth: current.depth + 1 });
    }
    if (Array.isArray(record.failures)) {
      for (const failure of record.failures.slice(0, 16)) {
        pending.push({ value: failure, depth: current.depth + 1 });
      }
    }
    if (
      typeof record.failuresByPos === "object" &&
      record.failuresByPos !== null
    ) {
      for (const failure of Object.values(record.failuresByPos).slice(0, 16)) {
        pending.push({ value: failure, depth: current.depth + 1 });
      }
    }
  }

  return names;
}

function storageError(error: unknown): ScheduleStorageError {
  if (error instanceof ScheduleStorageError) return error;

  const names = nestedErrorNames(error);
  if ([...names].some((name) => QUOTA_ERROR_NAMES.has(name))) {
    return new ScheduleStorageError("quota");
  }
  if ([...names].some((name) => UNAVAILABLE_ERROR_NAMES.has(name))) {
    return new ScheduleStorageError("unavailable");
  }
  return new ScheduleStorageError("unknown");
}

function productionStore(): ScheduleStore {
  if (typeof window === "undefined" || !db) {
    throw new ScheduleStorageError("unavailable");
  }

  return {
    async list() {
      return db.schedule_courses.toArray();
    },
    async put(course) {
      await db.schedule_courses.put(course);
    },
    async remove(id) {
      await db.schedule_courses.delete(id);
    },
    async clear() {
      await db.schedule_courses.clear();
    },
    async replaceAll(courses) {
      await db.transaction("rw", db.schedule_courses, async () => {
        await db.schedule_courses.clear();
        await db.schedule_courses.bulkAdd(courses);
      });
    },
  };
}

export class ScheduleRepository {
  constructor(private readonly storeFactory: ScheduleStoreFactory = productionStore) {}

  async list(): Promise<ScheduleCourse[]> {
    try {
      const rows = await this.storeFactory().list();
      try {
        return rows.map(parseStoredScheduleCourse);
      } catch (error) {
        if (error instanceof ScheduleValidationError) {
          throw new ScheduleStorageError("corrupt");
        }
        throw error;
      }
    } catch (error) {
      throw storageError(error);
    }
  }

  async put(value: unknown): Promise<ScheduleCourse> {
    const course = normalizeScheduleCourse(value);
    try {
      await this.storeFactory().put(course);
      return course;
    } catch (error) {
      throw storageError(error);
    }
  }

  async remove(id: string): Promise<void> {
    if (!isValidScheduleId(id)) {
      throw new ScheduleValidationError([
        { field: "id", message: "This saved identifier is invalid." },
      ]);
    }
    try {
      await this.storeFactory().remove(id.trim().toLowerCase());
    } catch (error) {
      throw storageError(error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.storeFactory().clear();
    } catch (error) {
      throw storageError(error);
    }
  }

  async replaceAll(values: readonly unknown[]): Promise<ScheduleCourse[]> {
    const courses = values.map(parseStoredScheduleCourse);
    const ids = new Set<string>();
    for (const course of courses) {
      if (ids.has(course.id)) {
        throw new ScheduleValidationError([
          { field: "id", message: "Each course must have a unique identifier." },
        ]);
      }
      ids.add(course.id);
    }

    try {
      await this.storeFactory().replaceAll(courses);
      return courses;
    } catch (error) {
      throw storageError(error);
    }
  }
}
