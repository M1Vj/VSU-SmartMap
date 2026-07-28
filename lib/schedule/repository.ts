import { db, type VSUDatabase } from "../db";
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
  type ScheduleOutboxMutation,
  type StoredScopedScheduleCourse,
} from "./local-types";
import {
  defaultScheduleMutationDependencies,
  desiredScheduleMutation,
  type ScheduleMutationDependencies,
} from "./outbox";

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
  accountPut(
    scope: ScheduleScope,
    course: ScheduleCourse,
    maximumCourses: number,
    dependencies: ScheduleMutationDependencies,
  ): Promise<void>;
  accountRemove(
    scope: ScheduleScope,
    id: string,
    dependencies: ScheduleMutationDependencies,
  ): Promise<void>;
  accountClear(
    scope: ScheduleScope,
    dependencies: ScheduleMutationDependencies,
  ): Promise<void>;
  accountReplaceAll(
    scope: ScheduleScope,
    courses: ScheduleCourse[],
    maximumCourses: number,
    dependencies: ScheduleMutationDependencies,
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
  return createDexieScopedScheduleStore(db);
}

export function createDexieScopedScheduleStore(
  database: VSUDatabase,
): ScopedScheduleStore {
  const pendingFor = (scope: ScheduleScope, courseId: string) =>
    database.schedule_outbox
      .where("[scope+courseId]")
      .equals([scope, courseId])
      .first();
  const replaceMutation = async (
    scope: ScheduleScope,
    courseId: string,
    mutation: ScheduleOutboxMutation | undefined,
  ) => {
    await database.schedule_outbox.where("[scope+courseId]").equals([scope, courseId]).delete();
    if (mutation) await database.schedule_outbox.add(mutation);
  };

  return {
    async list(scope) {
      const rows = await database.schedule_scoped_courses
        .where("scope")
        .equals(scope)
        .toArray();
      return rows.map((row) => row.course);
    },
    async put(scope, course, maximumCourses) {
      await database.transaction("rw", database.schedule_scoped_courses, async () => {
        const key = scopedCourseKey(scope, course.id);
        const existing = await database.schedule_scoped_courses.get(key);
        if (
          existing === undefined &&
          (await database.schedule_scoped_courses.where("scope").equals(scope).count()) >=
            maximumCourses
        ) {
          throw new ScheduleCourseLimitError();
        }
        await database.schedule_scoped_courses.put({
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
      await database.schedule_scoped_courses.delete(scopedCourseKey(scope, id));
    },
    async clear(scope) {
      await database.schedule_scoped_courses.where("scope").equals(scope).delete();
    },
    async replaceAll(scope, courses, maximumCourses) {
      if (courses.length > maximumCourses) {
        throw new ScheduleCourseLimitError();
      }
      await database.transaction("rw", database.schedule_scoped_courses, async () => {
        await database.schedule_scoped_courses.where("scope").equals(scope).delete();
        const rows: StoredScopedScheduleCourse[] = courses.map((course) => ({
          key: scopedCourseKey(scope, course.id),
          scope,
          id: course.id,
          course,
        }));
        await database.schedule_scoped_courses.bulkAdd(rows);
      });
    },
    async accountPut(scope, course, maximumCourses, dependencies) {
      await database.transaction(
        "rw",
        database.schedule_scoped_courses,
        database.schedule_outbox,
        async () => {
          const key = scopedCourseKey(scope, course.id);
          const existingRow = await database.schedule_scoped_courses.get(key);
          if (
            existingRow === undefined &&
            (await database.schedule_scoped_courses.where("scope").equals(scope).count()) >=
              maximumCourses
          ) {
            throw new ScheduleCourseLimitError();
          }
          const existingMutation = await pendingFor(scope, course.id);
          await database.schedule_scoped_courses.put({
            key,
            scope,
            id: course.id,
            course,
            ...(existingRow?.serverRevision === undefined
              ? {}
              : { serverRevision: existingRow.serverRevision }),
          });
          await replaceMutation(
            scope,
            course.id,
            desiredScheduleMutation({
              existing: existingMutation,
              scope,
              course,
              operation: "upsert",
              knownRevision: existingRow?.serverRevision,
              ...dependencies,
            }),
          );
        },
      );
    },
    async accountRemove(scope, id, dependencies) {
      await database.transaction(
        "rw",
        database.schedule_scoped_courses,
        database.schedule_outbox,
        async () => {
          const key = scopedCourseKey(scope, id);
          const row = await database.schedule_scoped_courses.get(key);
          const existingMutation = await pendingFor(scope, id);
          await database.schedule_scoped_courses.delete(key);
          await replaceMutation(
            scope,
            id,
            desiredScheduleMutation({
              existing: existingMutation,
              scope,
              courseId: id,
              operation: "delete",
              knownRevision: row?.serverRevision,
              ...dependencies,
            }),
          );
        },
      );
    },
    async accountClear(scope, dependencies) {
      await database.transaction(
        "rw",
        database.schedule_scoped_courses,
        database.schedule_outbox,
        async () => {
          const rows = await database.schedule_scoped_courses.where("scope").equals(scope).toArray();
          const pending = await database.schedule_outbox.where("scope").equals(scope).toArray();
          const pendingById = new Map(pending.map((mutation) => [mutation.courseId, mutation]));
          const desired = rows.map((row) =>
            desiredScheduleMutation({
              existing: pendingById.get(row.id),
              scope,
              courseId: row.id,
              operation: "delete",
              knownRevision: row.serverRevision,
              ...dependencies,
            }),
          );
          const sequences = rows
            .map((row) => pendingById.get(row.id)?.sequence)
            .filter((sequence): sequence is number => sequence !== undefined);
          const replacements = desired.filter(
            (mutation): mutation is ScheduleOutboxMutation => mutation !== undefined,
          );
          await database.schedule_scoped_courses.where("scope").equals(scope).delete();
          if (sequences.length > 0) {
            await database.schedule_outbox.bulkDelete(sequences);
          }
          if (replacements.length > 0) {
            await database.schedule_outbox.bulkAdd(replacements);
          }
        },
      );
    },
    async accountReplaceAll(scope, courses, maximumCourses, dependencies) {
      if (courses.length > maximumCourses) throw new ScheduleCourseLimitError();
      await database.transaction(
        "rw",
        database.schedule_scoped_courses,
        database.schedule_outbox,
        async () => {
          const rows = await database.schedule_scoped_courses.where("scope").equals(scope).toArray();
          const rowsById = new Map(rows.map((row) => [row.id, row]));
          const pending = await database.schedule_outbox.where("scope").equals(scope).toArray();
          const pendingById = new Map(pending.map((mutation) => [mutation.courseId, mutation]));
          const desiredById = new Map(courses.map((course) => [course.id, course]));
          const affectedIds = new Set([
            ...rowsById.keys(),
            ...pendingById.keys(),
            ...desiredById.keys(),
          ]);
          const desired = [...affectedIds].map((id) => {
            const course = desiredById.get(id);
            return desiredScheduleMutation({
              existing: pendingById.get(id),
              scope,
              courseId: id,
              operation: course ? "upsert" : "delete",
              course,
              knownRevision: rowsById.get(id)?.serverRevision,
              ...dependencies,
            });
          });
          const sequences = pending
            .map((mutation) => mutation.sequence)
            .filter((sequence): sequence is number => sequence !== undefined);
          const replacements = desired.filter(
            (mutation): mutation is ScheduleOutboxMutation => mutation !== undefined,
          );
          await database.schedule_scoped_courses.where("scope").equals(scope).delete();
          await database.schedule_scoped_courses.bulkAdd(
            courses.map((course) => {
              const prior = rowsById.get(course.id);
              return {
                key: scopedCourseKey(scope, course.id),
                scope,
                id: course.id,
                course,
                ...(prior?.serverRevision === undefined
                  ? {}
                  : { serverRevision: prior.serverRevision }),
              };
            }),
          );
          if (sequences.length > 0) {
            await database.schedule_outbox.bulkDelete(sequences);
          }
          if (replacements.length > 0) {
            await database.schedule_outbox.bulkAdd(replacements);
          }
        },
      );
    },
  };
}

export class ScheduleRepository {
  constructor(
    private readonly scope: ScheduleScope = GUEST_SCHEDULE_SCOPE,
    private readonly storeFactory: ScopedScheduleStoreFactory = productionStore,
    private readonly mutationDependencies: ScheduleMutationDependencies =
      defaultScheduleMutationDependencies,
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
      const store = this.storeFactory();
      if (this.scope === GUEST_SCHEDULE_SCOPE) {
        await store.put(this.scope, course, MAX_SCHEDULE_COURSES);
      } else {
        await store.accountPut(
          this.scope,
          course,
          MAX_SCHEDULE_COURSES,
          this.mutationDependencies,
        );
      }
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
      const canonicalId = id.trim().toLowerCase();
      const store = this.storeFactory();
      if (this.scope === GUEST_SCHEDULE_SCOPE) {
        await store.remove(this.scope, canonicalId);
      } else {
        await store.accountRemove(this.scope, canonicalId, this.mutationDependencies);
      }
    } catch (error) {
      throw storageError(error);
    }
  }

  async clear(): Promise<void> {
    try {
      const store = this.storeFactory();
      if (this.scope === GUEST_SCHEDULE_SCOPE) {
        await store.clear(this.scope);
      } else {
        await store.accountClear(this.scope, this.mutationDependencies);
      }
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
      const store = this.storeFactory();
      if (this.scope === GUEST_SCHEDULE_SCOPE) {
        await store.replaceAll(this.scope, courses, MAX_SCHEDULE_COURSES);
      } else {
        await store.accountReplaceAll(
          this.scope,
          courses,
          MAX_SCHEDULE_COURSES,
          this.mutationDependencies,
        );
      }
      return courses;
    } catch (error) {
      if (error instanceof ScheduleCourseLimitError) throw error;
      throw storageError(error);
    }
  }
}
