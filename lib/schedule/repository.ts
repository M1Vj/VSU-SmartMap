import { db } from "../db";
import {
  MAX_SCHEDULE_COURSES,
  type ScheduleCourse,
} from "./types";
import {
  ScheduleValidationError,
  isValidScheduleId,
  normalizeScheduleCourse,
  parseStoredScheduleCourse,
} from "./validation";
import {
  GUEST_SCHEDULE_SCOPE,
  type ScheduleScope,
} from "./scope";
import {
  scopedCourseKey,
  type StoredScopedScheduleCourse,
} from "./local-types";

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

export class ScheduleCourseLimitError extends Error {
  readonly code = "too_many_courses";

  constructor() {
    super(`A schedule can contain up to ${MAX_SCHEDULE_COURSES} courses.`);
    this.name = "ScheduleCourseLimitError";
  }
}

export interface ScopedScheduleStore {
  list(scope: ScheduleScope): Promise<unknown[]>;
  put(
    scope: ScheduleScope,
    course: ScheduleCourse,
    maximumCourses: number,
  ): Promise<void>;
  remove(scope: ScheduleScope, id: string): Promise<void>;
  clear(scope: ScheduleScope): Promise<void>;
  replaceAll(
    scope: ScheduleScope,
    courses: ScheduleCourse[],
    maximumCourses: number,
  ): Promise<void>;
}

export type ScopedScheduleStoreFactory = () => ScopedScheduleStore;

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

function nestedErrorDetails(error: unknown): {
  names: Set<string>;
  hasScheduleValidationError: boolean;
} {
  const names = new Set<string>();
  const seen = new Set<object>();
  let hasScheduleValidationError = false;
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
    if (current.value instanceof ScheduleValidationError) {
      hasScheduleValidationError = true;
    }

    const record = current.value as Record<string, unknown>;
    if (typeof record.name === "string") names.add(record.name);

    if (record.inner !== undefined) {
      pending.push({ value: record.inner, depth: current.depth + 1 });
    }
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

  return { names, hasScheduleValidationError };
}

function storageError(error: unknown): ScheduleStorageError {
  if (error instanceof ScheduleStorageError) return error;

  const { names, hasScheduleValidationError } = nestedErrorDetails(error);
  if ([...names].some((name) => QUOTA_ERROR_NAMES.has(name))) {
    return new ScheduleStorageError("quota");
  }
  if (hasScheduleValidationError) {
    return new ScheduleStorageError("corrupt");
  }
  if ([...names].some((name) => UNAVAILABLE_ERROR_NAMES.has(name))) {
    return new ScheduleStorageError("unavailable");
  }
  return new ScheduleStorageError("unknown");
}

function productionStore(): ScopedScheduleStore {
  if (typeof window === "undefined" || !db) {
    throw new ScheduleStorageError("unavailable");
  }

  return {
    async list(scope) {
      const rows = await db.schedule_scoped_courses
        .where("scope")
        .equals(scope)
        .toArray();
      return rows.map((row) => row.course);
    },
    async put(scope, course, maximumCourses) {
      await db.transaction("rw", db.schedule_scoped_courses, async () => {
        const key = scopedCourseKey(scope, course.id);
        const existing = await db.schedule_scoped_courses.get(key);
        if (
          existing === undefined &&
          (await db.schedule_scoped_courses.where("scope").equals(scope).count()) >=
            maximumCourses
        ) {
          throw new ScheduleCourseLimitError();
        }
        await db.schedule_scoped_courses.put({
          key,
          scope,
          id: course.id,
          course,
          ...(existing?.serverRevision === undefined
            ? {}
            : { serverRevision: existing.serverRevision }),
        });
      });
    },
    async remove(scope, id) {
      await db.schedule_scoped_courses.delete(scopedCourseKey(scope, id));
    },
    async clear(scope) {
      await db.schedule_scoped_courses.where("scope").equals(scope).delete();
    },
    async replaceAll(scope, courses, maximumCourses) {
      if (courses.length > maximumCourses) {
        throw new ScheduleCourseLimitError();
      }
      await db.transaction("rw", db.schedule_scoped_courses, async () => {
        await db.schedule_scoped_courses.where("scope").equals(scope).delete();
        const rows: StoredScopedScheduleCourse[] = courses.map((course) => ({
          key: scopedCourseKey(scope, course.id),
          scope,
          id: course.id,
          course,
        }));
        await db.schedule_scoped_courses.bulkAdd(rows);
      });
    },
  };
}

export class ScheduleRepository {
  constructor(
    private readonly scope: ScheduleScope = GUEST_SCHEDULE_SCOPE,
    private readonly storeFactory: ScopedScheduleStoreFactory = productionStore,
  ) {}

  async list(): Promise<ScheduleCourse[]> {
    try {
      const rows = await this.storeFactory().list(this.scope);
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
      await this.storeFactory().put(this.scope, course, MAX_SCHEDULE_COURSES);
      return course;
    } catch (error) {
      if (error instanceof ScheduleCourseLimitError) throw error;
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
      await this.storeFactory().remove(this.scope, id.trim().toLowerCase());
    } catch (error) {
      throw storageError(error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.storeFactory().clear(this.scope);
    } catch (error) {
      throw storageError(error);
    }
  }

  async replaceAll(values: readonly unknown[]): Promise<ScheduleCourse[]> {
    if (values.length > MAX_SCHEDULE_COURSES) {
      throw new ScheduleCourseLimitError();
    }
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
      await this.storeFactory().replaceAll(
        this.scope,
        courses,
        MAX_SCHEDULE_COURSES,
      );
      return courses;
    } catch (error) {
      if (error instanceof ScheduleCourseLimitError) throw error;
      throw storageError(error);
    }
  }
}
