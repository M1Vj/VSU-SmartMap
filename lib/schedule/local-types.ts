import type { ScheduleCourse } from "./types";
import type { ScheduleScope } from "./scope";

export interface StoredScopedScheduleCourse {
  key: string;
  scope: ScheduleScope;
  id: string;
  course: ScheduleCourse;
  serverRevision?: number;
}

export interface ScheduleOutboxMutation {
  sequence?: number;
  mutationId: string;
  scope: ScheduleScope;
  courseId: string;
  expectedRevision: number;
  operation: "upsert" | "delete";
  course?: ScheduleCourse;
  createdAt: string;
}

export interface ScheduleSyncState {
  scope: ScheduleScope;
  cursor?: number;
  consentEnabled?: boolean;
  reconciliationCompleted?: boolean;
  lastSuccessfulSyncAt?: string;
  lastError?: "sync-failed";
}

export interface StoredScheduleConflict {
  key: string;
  scope: ScheduleScope;
  courseId: string;
  local?: ScheduleCourse;
  remote?: ScheduleCourse;
  remoteDeleted?: boolean;
  serverRevision: number;
  reviewKind?: "conflict" | "quarantine";
}

export const scopedCourseKey = (scope: ScheduleScope, id: string): string =>
  `${scope}|${id}`;
