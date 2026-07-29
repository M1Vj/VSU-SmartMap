import type { ScheduleOutboxMutation } from "../local-types";
import { MAX_SCHEDULE_COURSES, type ScheduleCourse } from "../types";
import {
  isValidScheduleId,
  parseStoredScheduleCourse,
} from "../validation";
import type {
  AccountLocalScheduleVersion,
  CloudScheduleRow,
  PullRowResolution,
  ReconciliationCandidate,
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

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isTimestamp(value: string | undefined): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Number.isFinite(new Date(value).getTime())
  );
}

type ParsedCloudRow =
  | { kind: "active"; course: ScheduleCourse }
  | { kind: "tombstone" }
  | { kind: "invalid-row" }
  | { kind: "invalid-payload" };

function parseCloudRow(row: CloudScheduleRow): ParsedCloudRow {
  if (
    !isValidScheduleId(row.id) ||
    row.id !== row.id.trim().toLowerCase() ||
    !isPositiveInteger(row.revision) ||
    !isPositiveInteger(row.serverVersion) ||
    !isTimestamp(row.createdAt) ||
    !isTimestamp(row.updatedAt) ||
    (row.payload === null
      ? !isTimestamp(row.deletedAt)
      : row.deletedAt !== undefined)
  ) {
    return { kind: "invalid-row" };
  }
  if (row.payload === null) return { kind: "tombstone" };
  try {
    const course = parseStoredScheduleCourse(row.payload);
    return course.id === row.id
      ? { kind: "active", course }
      : { kind: "invalid-payload" };
  } catch {
    return { kind: "invalid-payload" };
  }
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
  const cloudTombstones = new Map<
    string,
    Extract<ReconciliationCandidate, { kind: "tombstone" }>
  >();
  const seenCloud = new Set<string>();
  for (const row of input.cloud) {
    if (seenCloud.has(row.id)) {
      issues.push({ kind: "duplicate-id", source: "cloud", courseId: row.id });
      continue;
    }
    seenCloud.add(row.id);
    const parsed = parseCloudRow(row);
    if (parsed.kind === "invalid-row" || parsed.kind === "invalid-payload") {
      issues.push({
        kind:
          parsed.kind === "invalid-row"
            ? "invalid-cloud-row"
            : "invalid-cloud-payload",
        source: "cloud",
        courseId: row.id,
      });
    } else if (parsed.kind === "tombstone") {
      cloudTombstones.set(row.id, {
        kind: "tombstone",
        source: "cloud",
        courseId: row.id,
        revision: row.revision,
        ...(row.deletedAt === undefined ? {} : { deletedAt: row.deletedAt }),
      });
    } else {
      cloudVersions.push({
        source: "cloud",
        course: parsed.course,
        revision: row.revision,
      });
    }
  }
  addVersions(byId, issues, "cloud", cloudVersions);

  const courses: ReconciliationVersion[] = [];
  const conflicts: Array<{
    courseId: string;
    versions: ReconciliationCandidate[];
  }> = [];
  const courseIds = new Set([...byId.keys(), ...cloudTombstones.keys()]);
  for (const courseId of [...courseIds].sort(compareIds)) {
    const versions = byId.get(courseId) ?? [];
    const tombstone = cloudTombstones.get(courseId);
    if (tombstone) {
      if (versions.length > 0) {
        conflicts.push({
          courseId,
          versions: [
            ...versions
              .sort(
                (a, b) =>
                  SOURCE_ORDER.indexOf(a.source) -
                  SOURCE_ORDER.indexOf(b.source),
              )
              .map((version) => ({ kind: "active" as const, ...version })),
            tombstone,
          ],
        });
      }
      continue;
    }
    const signatures = new Set(versions.map(({ course }) => semanticCourse(course)));
    if (signatures.size === 1) {
      courses.push(preferredVersion(versions));
    } else {
      conflicts.push({
        courseId,
        versions: [...versions].sort(
          (a, b) =>
            SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source),
        ).map((version) => ({ kind: "active", ...version })),
      });
    }
  }
  if (byId.size > MAX_SCHEDULE_COURSES) {
    issues.push({
      kind: "course-limit-exceeded",
      source: "merged",
      courseId: "schedule",
    });
  }
  issues.sort(
    (a, b) =>
      compareIds(a.courseId, b.courseId) ||
      SOURCE_ORDER.indexOf(a.source as ReconciliationSource) -
        SOURCE_ORDER.indexOf(b.source as ReconciliationSource) ||
      compareIds(a.kind, b.kind),
  );
  if (issues.length > 0) return { kind: "invalid", courses, conflicts, issues };
  return conflicts.length > 0
    ? { kind: "conflict", courses, conflicts }
    : { kind: "merge-ready", courses };
}

export function resolvePulledRow(input: {
  accountLocal: AccountLocalScheduleVersion | undefined;
  cloud: CloudScheduleRow;
  pendingMutation?: ScheduleOutboxMutation;
}): PullRowResolution {
  const parsed = parseCloudRow(input.cloud);
  if (parsed.kind === "invalid-row") {
    return { kind: "invalid-cloud-row", courseId: input.cloud.id };
  }
  if (parsed.kind === "invalid-payload") {
    return { kind: "invalid-cloud-payload", courseId: input.cloud.id };
  }
  const remote = parsed.kind === "active" ? parsed.course : undefined;
  const { pendingMutation } = input;
  if (
    pendingMutation &&
    (pendingMutation.courseId !== input.cloud.id ||
      (pendingMutation.operation === "upsert" && !pendingMutation.course))
  ) {
    return { kind: "invalid-cloud-payload", courseId: input.cloud.id };
  }
  if (
    input.accountLocal?.serverRevision !== undefined &&
    input.cloud.revision < input.accountLocal.serverRevision
  ) {
    return { kind: "no-change", serverRevision: input.cloud.revision };
  }

  if (input.cloud.payload === null) {
    if (pendingMutation?.operation === "upsert") {
      if (input.cloud.revision !== pendingMutation.expectedRevision) {
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
    if (input.cloud.revision !== pendingMutation.expectedRevision) {
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
