import type { ScheduleOutboxMutation } from "./local-types";
import { GUEST_SCHEDULE_SCOPE, type ScheduleScope } from "./scope";
import type { ScheduleCourse } from "./types";
import { isValidScheduleId } from "./validation";

export interface ScheduleMutationDependencies {
  mutationId: () => string;
  now: () => Date;
}

export const defaultScheduleMutationDependencies: ScheduleMutationDependencies = {
  mutationId: () => crypto.randomUUID(),
  now: () => new Date(),
};

type CreateMutationInput = {
  scope: ScheduleScope;
  courseId: string;
  expectedRevision?: number;
  operation: "upsert" | "delete";
  course?: ScheduleCourse;
  mutationId?: () => string;
  now?: () => Date;
};

export function createScheduleMutation(
  input: CreateMutationInput,
): ScheduleOutboxMutation {
  if (input.scope === GUEST_SCHEDULE_SCOPE) {
    throw new Error("Guest schedules do not create sync mutations.");
  }
  const courseId = input.courseId.trim().toLowerCase();
  const mutationId = (
    input.mutationId ?? defaultScheduleMutationDependencies.mutationId
  )()
    .trim()
    .toLowerCase();
  if (!isValidScheduleId(courseId) || !isValidScheduleId(mutationId)) {
    throw new Error("Schedule mutations require canonical UUID identifiers.");
  }
  const expectedRevision = input.expectedRevision ?? 0;
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new Error("Schedule mutation revision is invalid.");
  }
  if (input.operation === "upsert" && input.course?.id !== courseId) {
    throw new Error("Schedule mutation course does not match its identifier.");
  }
  return {
    mutationId,
    scope: input.scope,
    courseId,
    expectedRevision,
    operation: input.operation,
    ...(input.course === undefined ? {} : { course: input.course }),
    createdAt: (input.now ?? defaultScheduleMutationDependencies.now)().toISOString(),
  };
}

export function desiredScheduleMutation(input: {
  existing?: ScheduleOutboxMutation;
  scope: ScheduleScope;
  courseId?: string;
  knownRevision?: number;
  operation: "upsert" | "delete";
  course?: ScheduleCourse;
  mutationId?: () => string;
  now?: () => Date;
}): ScheduleOutboxMutation | undefined {
  const courseId = input.course?.id ?? input.courseId;
  if (!courseId) throw new Error("A course identifier is required.");
  const expectedRevision =
    input.existing?.expectedRevision ?? input.knownRevision ?? 0;
  if (input.operation === "delete" && expectedRevision === 0) return undefined;
  return createScheduleMutation({
    scope: input.scope,
    courseId,
    expectedRevision,
    operation: input.operation,
    course: input.operation === "upsert" ? input.course : undefined,
    mutationId: input.mutationId,
    now: input.now,
  });
}
