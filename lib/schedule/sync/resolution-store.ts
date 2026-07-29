import type { VSUDatabase } from "../../db";
import { scopedCourseKey } from "../local-types";
import { createScheduleMutation, type ScheduleMutationDependencies } from "../outbox";
import { isValidScheduleId, parseStoredScheduleCourse } from "../validation";
import type {
  AtomicScheduleResolutionStore,
  CourseResolutionPlan,
  ScheduleResolutionPlan,
} from "./resolution";

function canonicalAccountScope(scope: string): boolean {
  if (!scope.startsWith("user:")) return false;
  const id = scope.slice(5);
  return isValidScheduleId(id) && id === id.trim().toLowerCase();
}

function revision(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function validateCoursePlan(plan: CourseResolutionPlan, scope: string): void {
  if (
    plan.kind !== "course-resolution" ||
    plan.scope !== scope ||
    !isValidScheduleId(plan.courseId) ||
    plan.courseId !== plan.courseId.trim().toLowerCase() ||
    !revision(plan.serverRevision) ||
    plan.clearSuperseded !== true
  ) {
    throw new Error("Invalid atomic schedule resolution plan.");
  }
  if (plan.local.kind === "put") {
    const course = parseStoredScheduleCourse(plan.local.course);
    if (course.id !== plan.courseId) {
      throw new Error("Resolution course identifier mismatch.");
    }
  } else if (plan.local.courseId !== plan.courseId) {
    throw new Error("Resolution deletion identifier mismatch.");
  }
  if (plan.mutation) {
    if (
      plan.mutation.courseId !== plan.courseId ||
      !revision(plan.mutation.expectedRevision) ||
      plan.mutation.expectedRevision !== plan.serverRevision
    ) {
      throw new Error("Resolution mutation identifier mismatch.");
    }
    if (plan.mutation.operation === "upsert") {
      const course = parseStoredScheduleCourse(plan.mutation.course);
      if (
        course.id !== plan.courseId ||
        plan.local.kind !== "put" ||
        plan.local.course.id !== course.id
      ) {
        throw new Error("Resolution upsert payload mismatch.");
      }
    } else if (plan.mutation.course !== undefined) {
      throw new Error("Resolution delete cannot carry a payload.");
    }
  }
}

function validatePlan(plan: ScheduleResolutionPlan): void {
  if (!canonicalAccountScope(plan.scope)) {
    throw new Error("Invalid reconciliation account scope.");
  }
  if (plan.kind === "course-resolution") {
    validateCoursePlan(plan, plan.scope);
    return;
  }
  if (plan.kind === "use-cloud") {
    if (
      plan.clearSuperseded !== true ||
      plan.courses.length > 200
    ) {
      throw new Error("Invalid use-cloud resolution plan.");
    }
    const ids = new Set<string>();
    for (const row of plan.courses) {
      const course = parseStoredScheduleCourse(row.course);
      if (
        ids.has(course.id) ||
        !revision(row.serverRevision)
      ) {
        throw new Error("Duplicate or invalid cloud resolution row.");
      }
      ids.add(course.id);
    }
    for (const id of plan.deletedCourseIds) {
      if (
        !isValidScheduleId(id) ||
        id !== id.trim().toLowerCase() ||
        ids.has(id)
      ) {
        throw new Error("Invalid cloud tombstone resolution.");
      }
      ids.add(id);
    }
    return;
  }
  const ids = new Set<string>();
  let active = 0;
  for (const item of plan.desired) {
    validateCoursePlan(item, plan.scope);
    if (ids.has(item.courseId)) {
      throw new Error("Duplicate course resolution.");
    }
    ids.add(item.courseId);
    if (item.local.kind === "put") active += 1;
  }
  if (active > 200) throw new Error("Resolved schedule exceeds the course limit.");
}

export function createDexieAtomicScheduleResolutionStore(
  database: VSUDatabase,
  mutationDependencies: ScheduleMutationDependencies,
): AtomicScheduleResolutionStore {
  const clearCourseState = async (scope: string, courseId: string) => {
    await database.schedule_outbox
      .where("[scope+courseId]")
      .equals([scope, courseId])
      .delete();
    await database.schedule_conflicts.delete(scopedCourseKey(scope as never, courseId));
  };

  const applyCourse = async (item: CourseResolutionPlan) => {
    if (item.local.kind === "put") {
      await database.schedule_scoped_courses.put({
        key: scopedCourseKey(item.scope, item.courseId),
        scope: item.scope,
        id: item.courseId,
        course: parseStoredScheduleCourse(item.local.course),
        serverRevision: item.serverRevision,
      });
    } else {
      await database.schedule_scoped_courses.delete(
        scopedCourseKey(item.scope, item.courseId),
      );
    }
    await clearCourseState(item.scope, item.courseId);
    if (item.mutation) {
      await database.schedule_outbox.add(
        createScheduleMutation({
          scope: item.scope,
          courseId: item.courseId,
          expectedRevision: item.mutation.expectedRevision,
          operation: item.mutation.operation,
          course:
            item.mutation.operation === "upsert"
              ? parseStoredScheduleCourse(item.mutation.course)
              : undefined,
          ...mutationDependencies,
        }),
      );
    }
  };

  return {
    async apply(plan) {
      validatePlan(plan);
      await database.transaction(
        "rw",
        database.schedule_scoped_courses,
        database.schedule_outbox,
        database.schedule_conflicts,
        database.schedule_sync_state,
        async () => {
          if (plan.kind === "use-cloud") {
            await database.schedule_scoped_courses
              .where("scope")
              .equals(plan.scope)
              .delete();
            await database.schedule_scoped_courses.bulkAdd(
              plan.courses.map(({ course, serverRevision }) => ({
                key: scopedCourseKey(plan.scope, course.id),
                scope: plan.scope,
                id: course.id,
                course: parseStoredScheduleCourse(course),
                serverRevision,
              })),
            );
            await database.schedule_outbox.where("scope").equals(plan.scope).delete();
            await database.schedule_conflicts.where("scope").equals(plan.scope).delete();
          } else if (plan.kind === "course-resolution") {
            await applyCourse(plan);
          } else {
            if (plan.kind === "replace-cloud") {
              await database.schedule_outbox.where("scope").equals(plan.scope).delete();
              await database.schedule_conflicts.where("scope").equals(plan.scope).delete();
            }
            for (const item of plan.desired) await applyCourse(item);
            if (plan.kind === "replace-cloud") {
              const desiredIds = new Set(plan.desired.map(({ courseId }) => courseId));
              const extraRows = await database.schedule_scoped_courses
                .where("scope")
                .equals(plan.scope)
                .toArray();
              for (const row of extraRows) {
                if (!desiredIds.has(row.id)) {
                  await database.schedule_scoped_courses.delete(row.key);
                }
              }
            }
          }
          const state = await database.schedule_sync_state.get(plan.scope);
          await database.schedule_sync_state.put({
            ...state,
            scope: plan.scope,
            reconciliationCompleted: true,
          });
        },
      );
    },
  };
}
