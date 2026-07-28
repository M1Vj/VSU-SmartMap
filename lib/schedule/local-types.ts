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
}

export interface StoredScheduleConflict {
  key: string;
  scope: ScheduleScope;
  courseId: string;
  local?: ScheduleCourse;
  remote?: ScheduleCourse;
  serverRevision: number;
}

export const scopedCourseKey = (scope: ScheduleScope, id: string): string =>
  `${scope}|${id}`;
