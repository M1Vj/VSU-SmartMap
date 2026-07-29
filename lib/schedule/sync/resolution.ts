import type { ScheduleOutboxMutation } from "../local-types";
import type { ScheduleScope } from "../scope";
import { MAX_SCHEDULE_COURSES, type ScheduleCourse } from "../types";
import { isValidScheduleId } from "../validation";
import type {
  PerCourseResolution,
  ReconciliationCandidate,
  ReconciliationChoice,
  ReconciliationSource,
  ScheduleSourceReconciliation,
} from "./types";

type ReconciliationConflict = {
  courseId: string;
  versions: ReconciliationCandidate[];
};

export type ChoiceValidation =
  | { kind: "valid" }
  | { kind: "incomplete-review"; courseIds: string[] }
  | { kind: "invalid-choice"; courseIds: string[] }
  | { kind: "review-required" }
  | { kind: "course-limit-exceeded"; limit: number };

export type CourseResolutionPlan = {
  kind: "course-resolution";
  scope: ScheduleScope;
  courseId: string;
  local:
    | { kind: "put"; course: ScheduleCourse }
    | { kind: "delete"; courseId: string };
  serverRevision: number;
  mutation?: Pick<
    ScheduleOutboxMutation,
    "courseId" | "expectedRevision" | "operation" | "course"
  >;
  clearSuperseded: true;
};

export type ScheduleResolutionPlan =
  | CourseResolutionPlan
  | {
      kind: "review-merge";
      scope: ScheduleScope;
      desired: readonly CourseResolutionPlan[];
    }
  | {
      kind: "replace-cloud";
      scope: ScheduleScope;
      desired: readonly CourseResolutionPlan[];
    }
  | {
      kind: "use-cloud";
      scope: ScheduleScope;
      courses: readonly {
        course: ScheduleCourse;
        serverRevision: number;
      }[];
      deletedCourseIds: readonly string[];
      clearSuperseded: true;
    };

/**
 * The concrete adapter must apply a plan in one IndexedDB transaction. A single
 * method deliberately prevents callers from interleaving local, outbox, and
 * conflict writes or supplying mutation identities.
 */
export interface AtomicScheduleResolutionStore {
  apply(plan: ScheduleResolutionPlan): Promise<void>;
}

type ValidatedDeviceVersion = {
  source: Exclude<ReconciliationSource, "cloud">;
  course: ScheduleCourse;
};

type ValidatedCloudCandidate =
  | {
      kind: "active";
      source: "cloud";
      course: ScheduleCourse;
      revision: number;
    }
  | {
      kind: "tombstone";
      source: "cloud";
      courseId: string;
      revision: number;
      deletedAt?: string;
    };

function conflictsOf(
  reconciliation: ScheduleSourceReconciliation,
): readonly ReconciliationConflict[] {
  return reconciliation.kind === "merge-ready"
    ? []
    : reconciliation.conflicts;
}

function canonicalId(id: string): boolean {
  return isValidScheduleId(id) && id === id.trim().toLowerCase();
}

function accountScope(scope: ScheduleScope): boolean {
  return scope.startsWith("user:") && canonicalId(scope.slice(5));
}

function activeCount(
  reconciliation: ScheduleSourceReconciliation,
  choices: Readonly<Record<string, ReconciliationSource>>,
): number {
  let count = reconciliation.courses.length;
  for (const conflict of conflictsOf(reconciliation)) {
    const selected = choices[conflict.courseId];
    const candidate = conflict.versions.find(
      (version) => version.source === selected,
    );
    if (candidate?.kind === "active") count += 1;
  }
  return count;
}

export function validateReconciliationChoice(
  reconciliation: ScheduleSourceReconciliation,
  choice: ReconciliationChoice,
): ChoiceValidation {
  if (choice.kind === "cancel") return { kind: "valid" };
  if (reconciliation.kind === "invalid") {
    if (
      reconciliation.issues.some(
        (issue) => issue.kind === "course-limit-exceeded",
      )
    ) {
      return { kind: "course-limit-exceeded", limit: MAX_SCHEDULE_COURSES };
    }
    return { kind: "review-required" };
  }
  if (choice.kind !== "review-merge") return { kind: "valid" };

  const conflictIds = new Set(
    conflictsOf(reconciliation).map(({ courseId }) => courseId),
  );
  const invalid = Object.entries(choice.choices)
    .filter(([courseId, source]) => {
      if (!canonicalId(courseId) || !conflictIds.has(courseId)) return true;
      const conflict = conflictsOf(reconciliation).find(
        (candidate) => candidate.courseId === courseId,
      );
      return !conflict?.versions.some((version) => version.source === source);
    })
    .map(([courseId]) => courseId);
  if (invalid.length > 0) {
    return { kind: "invalid-choice", courseIds: invalid.sort() };
  }
  const missing = conflictsOf(reconciliation)
    .map(({ courseId }) => courseId)
    .filter((courseId) => choice.choices[courseId] === undefined);
  if (missing.length > 0) {
    return { kind: "incomplete-review", courseIds: missing };
  }
  if (activeCount(reconciliation, choice.choices) > MAX_SCHEDULE_COURSES) {
    return { kind: "course-limit-exceeded", limit: MAX_SCHEDULE_COURSES };
  }
  return { kind: "valid" };
}

function latestCloudRevision(
  versions: readonly ReconciliationCandidate[],
): number {
  return versions.reduce(
    (latest, candidate) =>
      candidate.source === "cloud"
        ? Math.max(latest, candidate.revision ?? 0)
        : latest,
    0,
  );
}

export function buildCourseResolutionPlan(input: {
  scope: ScheduleScope;
  conflict: ReconciliationConflict;
  resolution: PerCourseResolution;
}):
  | { kind: "ready"; plan: CourseResolutionPlan }
  | { kind: "cancel" }
  | { kind: "invalid-resolution" } {
  if (
    !accountScope(input.scope) ||
    input.resolution.courseId !== input.conflict.courseId ||
    !canonicalId(input.conflict.courseId)
  ) {
    return { kind: "invalid-resolution" };
  }
  if (input.resolution.kind === "cancel") return { kind: "cancel" };
  const source = input.resolution.source;
  const chosen = input.conflict.versions.find(
    (version) => version.source === source,
  );
  if (!chosen) return { kind: "invalid-resolution" };
  const serverRevision = latestCloudRevision(input.conflict.versions);
  if (chosen.kind === "tombstone") {
    return {
      kind: "ready",
      plan: {
        kind: "course-resolution",
        scope: input.scope,
        courseId: input.conflict.courseId,
        local: { kind: "delete", courseId: input.conflict.courseId },
        serverRevision: chosen.revision,
        clearSuperseded: true,
      },
    };
  }
  const cloud = chosen.source === "cloud";
  return {
    kind: "ready",
    plan: {
      kind: "course-resolution",
      scope: input.scope,
      courseId: input.conflict.courseId,
      local: { kind: "put", course: chosen.course },
      serverRevision: cloud ? chosen.revision ?? serverRevision : serverRevision,
      ...(cloud
        ? {}
        : {
            mutation: {
              courseId: chosen.course.id,
              expectedRevision: serverRevision,
              operation: "upsert" as const,
              course: chosen.course,
            },
          }),
      clearSuperseded: true,
    },
  };
}

function compareCourseId(
  a: { courseId: string },
  b: { courseId: string },
): number {
  return a.courseId < b.courseId ? -1 : a.courseId > b.courseId ? 1 : 0;
}

function cloudRevisionById(
  cloud: readonly ValidatedCloudCandidate[],
): Map<string, number> {
  return new Map(
    cloud.map((candidate) => [
      candidate.kind === "active" ? candidate.course.id : candidate.courseId,
      candidate.revision ?? 0,
    ]),
  );
}

export function buildReconciliationResolutionPlan(input: {
  scope: ScheduleScope;
  reconciliation: ScheduleSourceReconciliation;
  choice: ReconciliationChoice;
  deviceCourses: readonly ValidatedDeviceVersion[];
  cloud: readonly ValidatedCloudCandidate[];
}):
  | { kind: "ready"; plan: ScheduleResolutionPlan }
  | { kind: "cancel" }
  | { kind: "invalid-resolution"; reason: ChoiceValidation["kind"] } {
  if (input.choice.kind === "cancel") return { kind: "cancel" };
  if (!accountScope(input.scope)) {
    return { kind: "invalid-resolution", reason: "invalid-choice" };
  }
  const validation = validateReconciliationChoice(
    input.reconciliation,
    input.choice,
  );
  if (validation.kind !== "valid") {
    return { kind: "invalid-resolution", reason: validation.kind };
  }
  if (
    input.deviceCourses.length > MAX_SCHEDULE_COURSES ||
    input.cloud.filter((candidate) => candidate.kind === "active").length >
      MAX_SCHEDULE_COURSES
  ) {
    return {
      kind: "invalid-resolution",
      reason: "course-limit-exceeded",
    };
  }
  const revisions = cloudRevisionById(input.cloud);

  if (input.choice.kind === "use-cloud") {
    const courses = input.cloud
      .filter(
        (candidate): candidate is Extract<ValidatedCloudCandidate, { kind: "active" }> =>
          candidate.kind === "active",
      )
      .map((candidate) => ({
        course: candidate.course,
        serverRevision: candidate.revision ?? 0,
      }))
      .sort((a, b) =>
        a.course.id < b.course.id ? -1 : a.course.id > b.course.id ? 1 : 0,
      );
    const deletedCourseIds = input.cloud
      .filter(
        (candidate): candidate is Extract<ValidatedCloudCandidate, { kind: "tombstone" }> =>
          candidate.kind === "tombstone",
      )
      .map(({ courseId }) => courseId)
      .sort();
    return {
      kind: "ready",
      plan: {
        kind: "use-cloud",
        scope: input.scope,
        courses,
        deletedCourseIds,
        clearSuperseded: true,
      },
    };
  }

  if (input.choice.kind === "replace-cloud") {
    const device = new Map<string, ValidatedDeviceVersion>();
    for (const version of input.deviceCourses) {
      if (!canonicalId(version.course.id)) {
        return { kind: "invalid-resolution", reason: "invalid-choice" };
      }
      const existing = device.get(version.course.id);
      if (!existing || version.source === "account-local") {
        device.set(version.course.id, version);
      }
    }
    const cloudActiveIds = input.cloud
      .filter((candidate) => candidate.kind === "active")
      .map((candidate) => candidate.course.id);
    const ids = [...new Set([...device.keys(), ...cloudActiveIds])].sort();
    const desired: CourseResolutionPlan[] = ids.map((courseId) => {
      const selected = device.get(courseId);
      const expectedRevision = revisions.get(courseId) ?? 0;
      return selected
        ? {
            kind: "course-resolution",
            scope: input.scope,
            courseId,
            local: { kind: "put", course: selected.course },
            serverRevision: expectedRevision,
            mutation: {
              courseId,
              expectedRevision,
              operation: "upsert",
              course: selected.course,
            },
            clearSuperseded: true,
          }
        : {
            kind: "course-resolution",
            scope: input.scope,
            courseId,
            local: { kind: "delete", courseId },
            serverRevision: expectedRevision,
            mutation: {
              courseId,
              expectedRevision,
              operation: "delete",
            },
            clearSuperseded: true,
          };
    });
    return {
      kind: "ready",
      plan: { kind: "replace-cloud", scope: input.scope, desired },
    };
  }

  const desired: CourseResolutionPlan[] = [];
  for (const version of input.reconciliation.courses) {
    const conflict: ReconciliationConflict = {
      courseId: version.course.id,
      versions: [
        { kind: "active", ...version },
        ...input.cloud.filter((candidate) =>
          (candidate.kind === "active"
            ? candidate.course.id
            : candidate.courseId) === version.course.id &&
          candidate.source !== version.source
        ),
      ],
    };
    const result = buildCourseResolutionPlan({
      scope: input.scope,
      conflict,
      resolution: {
        kind: "choose-source",
        courseId: version.course.id,
        source: version.source,
      },
    });
    if (result.kind !== "ready") {
      return { kind: "invalid-resolution", reason: "invalid-choice" };
    }
    desired.push(result.plan);
  }
  for (const conflict of conflictsOf(input.reconciliation)) {
    const result = buildCourseResolutionPlan({
      scope: input.scope,
      conflict,
      resolution: {
        kind: "choose-source",
        courseId: conflict.courseId,
        source: input.choice.choices[conflict.courseId]!,
      },
    });
    if (result.kind !== "ready") {
      return { kind: "invalid-resolution", reason: "invalid-choice" };
    }
    desired.push(result.plan);
  }
  desired.sort(compareCourseId);
  return {
    kind: "ready",
    plan: { kind: "review-merge", scope: input.scope, desired },
  };
}

export async function applyScheduleResolution(
  store: AtomicScheduleResolutionStore,
  plan: ScheduleResolutionPlan | { kind: "cancel" },
): Promise<void> {
  if (plan.kind === "cancel") return;
  await store.apply(plan);
}
