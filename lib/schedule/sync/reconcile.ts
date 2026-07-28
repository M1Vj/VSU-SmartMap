import type { ScheduleOutboxMutation } from "../local-types";
import type { ScheduleCourse } from "../types";
import { parseStoredScheduleCourse } from "../validation";
import type {
  AccountLocalScheduleVersion,
  CloudScheduleRow,
  PullRowResolution,
  ReconciliationIssue,
  ReconciliationSource,
  ReconciliationVersion,
  ScheduleSourceReconciliation,
} from "./types";

const SOURCE_ORDER: readonly ReconciliationSource[] = [
  "guest",
  "account-local",
  "cloud",
];

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function semanticCourse(course: ScheduleCourse): string {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...document } = course;
  return canonicalJson(document);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => compareIds(a, b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function addVersions(
  target: Map<string, ReconciliationVersion[]>,
  issues: ReconciliationIssue[],
  source: ReconciliationSource,
  versions: readonly ReconciliationVersion[],
): void {
  const seen = new Set<string>();
  for (const version of versions) {
    const id = version.course.id;
    if (seen.has(id)) {
      issues.push({ kind: "duplicate-id", source, courseId: id });
      continue;
    }
    seen.add(id);
    const existing = target.get(id);
    if (existing) existing.push(version);
    else target.set(id, [version]);
  }
}

function preferredVersion(
  versions: readonly ReconciliationVersion[],
): ReconciliationVersion {
  return [...versions].sort(
    (a, b) => SOURCE_ORDER.indexOf(b.source) - SOURCE_ORDER.indexOf(a.source),
  )[0]!;
}

export function reconcileScheduleSources(input: {
  guest: readonly ScheduleCourse[];
  accountLocal: readonly AccountLocalScheduleVersion[];
  cloud: readonly CloudScheduleRow[];
}): ScheduleSourceReconciliation {
  const byId = new Map<string, ReconciliationVersion[]>();
  const issues: ReconciliationIssue[] = [];

  addVersions(
    byId,
    issues,
    "guest",
    input.guest.map((course) => ({ source: "guest", course })),
  );
  addVersions(
    byId,
    issues,
    "account-local",
    input.accountLocal.map(({ course, serverRevision }) => ({
      source: "account-local",
      course,
      ...(serverRevision === undefined ? {} : { revision: serverRevision }),
    })),
  );

  const cloudVersions: ReconciliationVersion[] = [];
  const seenCloud = new Set<string>();
  for (const row of input.cloud) {
    if (seenCloud.has(row.id)) {
      issues.push({ kind: "duplicate-id", source: "cloud", courseId: row.id });
      continue;
    }
    seenCloud.add(row.id);
    let parsed: ScheduleCourse | undefined;
    if (row.payload !== null) {
      try {
        parsed = parseStoredScheduleCourse(row.payload);
        if (parsed.id !== row.id) throw new Error("Cloud row ID mismatch.");
      } catch {
        issues.push({
          kind: "invalid-cloud-payload",
          source: "cloud",
          courseId: row.id,
        });
      }
    }
    if (parsed) {
      cloudVersions.push({
        source: "cloud",
        course: parsed,
        revision: row.revision,
      });
    }
  }
  addVersions(byId, issues, "cloud", cloudVersions);
  if (issues.length > 0) return { kind: "invalid", issues };

  const courses: ReconciliationVersion[] = [];
  const conflicts: Array<{
    courseId: string;
    versions: ReconciliationVersion[];
  }> = [];
  for (const courseId of [...byId.keys()].sort(compareIds)) {
    const versions = byId.get(courseId)!;
    const signatures = new Set(versions.map(({ course }) => semanticCourse(course)));
    if (signatures.size === 1) {
      courses.push(preferredVersion(versions));
    } else {
      conflicts.push({
        courseId,
        versions: [...versions].sort(
          (a, b) =>
            SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source),
        ),
      });
    }
  }
  return conflicts.length > 0
    ? { kind: "conflict", courses, conflicts }
    : { kind: "merge-ready", courses };
}

function validCloudCourse(row: CloudScheduleRow): ScheduleCourse | undefined {
  if (row.payload === null) return undefined;
  const course = parseStoredScheduleCourse(row.payload);
  if (course.id !== row.id) throw new Error("Cloud row ID mismatch.");
  return course;
}

export function resolvePulledRow(input: {
  accountLocal: AccountLocalScheduleVersion | undefined;
  cloud: CloudScheduleRow;
  pendingMutation?: ScheduleOutboxMutation;
}): PullRowResolution {
  let remote: ScheduleCourse | undefined;
  try {
    remote = validCloudCourse(input.cloud);
  } catch {
    return { kind: "invalid-cloud-payload", courseId: input.cloud.id };
  }
  const { pendingMutation } = input;
  if (
    pendingMutation &&
    (pendingMutation.courseId !== input.cloud.id ||
      (pendingMutation.operation === "upsert" && !pendingMutation.course))
  ) {
    return { kind: "invalid-cloud-payload", courseId: input.cloud.id };
  }

  if (input.cloud.payload === null) {
    if (pendingMutation?.operation === "upsert") {
      if (input.cloud.revision > pendingMutation.expectedRevision) {
        return {
          kind: "conflict",
          local: pendingMutation.course ?? input.accountLocal?.course,
          pendingMutation,
          serverRevision: input.cloud.revision,
        };
      }
      return {
        kind: "keep-local",
        pendingMutation,
        serverRevision: input.cloud.revision,
      };
    }
    return input.accountLocal || pendingMutation
      ? { kind: "delete-local", serverRevision: input.cloud.revision }
      : { kind: "no-change", serverRevision: input.cloud.revision };
  }
  if (!remote) {
    return { kind: "invalid-cloud-payload", courseId: input.cloud.id };
  }

  if (pendingMutation) {
    if (input.cloud.revision > pendingMutation.expectedRevision) {
      return {
        kind: "conflict",
        local:
          pendingMutation.operation === "upsert"
            ? pendingMutation.course
            : input.accountLocal?.course,
        remote,
        pendingMutation,
        serverRevision: input.cloud.revision,
      };
    }
    return {
      kind: "keep-local",
      pendingMutation,
      serverRevision: input.cloud.revision,
    };
  }
  return {
    kind: "replace-local",
    course: remote,
    serverRevision: input.cloud.revision,
  };
}
