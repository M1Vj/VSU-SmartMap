import type { ScheduleOutboxMutation } from "../local-types";
import type { ScheduleCourse } from "../types";

export type CloudScheduleRow = {
  id: string;
  payload: unknown | null;
  revision: number;
  serverVersion: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type CloudMutationResult =
  | {
      kind: "accepted";
      status: "upserted" | "deleted" | "replayed";
      row: CloudScheduleRow;
    }
  | {
      kind: "deleted-noop";
      courseId: string;
      revision: 0;
    }
  | {
      kind: "conflict";
      courseId: string;
      remote?: CloudScheduleRow;
    };

export type AccountLocalScheduleVersion = {
  course: ScheduleCourse;
  serverRevision?: number;
};

export type ReconciliationSource = "guest" | "account-local" | "cloud";

export type ReconciliationVersion = {
  source: ReconciliationSource;
  course: ScheduleCourse;
  revision?: number;
};

export type ReconciliationCandidate =
  | (ReconciliationVersion & { kind: "active" })
  | {
      kind: "tombstone";
      source: "cloud";
      courseId: string;
      revision: number;
      deletedAt?: string;
    };

export type ReconciliationIssue =
  | {
      kind: "duplicate-id";
      source: ReconciliationSource;
      courseId: string;
    }
  | {
      kind: "invalid-cloud-payload";
      source: "cloud";
      courseId: string;
    }
  | {
      kind: "invalid-cloud-row";
      source: "cloud";
      courseId: string;
    }
  | {
      kind: "course-limit-exceeded";
      source: "merged";
      courseId: "schedule";
    };

export type ScheduleSourceReconciliation =
  | {
      kind: "merge-ready";
      courses: ReconciliationVersion[];
    }
  | {
      kind: "conflict";
      courses: ReconciliationVersion[];
      conflicts: Array<{
        courseId: string;
        versions: ReconciliationCandidate[];
      }>;
    }
  | {
      kind: "invalid";
      courses: ReconciliationVersion[];
      conflicts: Array<{
        courseId: string;
        versions: ReconciliationCandidate[];
      }>;
      issues: ReconciliationIssue[];
    };

export type PullRowResolution =
  | {
      kind: "replace-local";
      course: ScheduleCourse;
      serverRevision: number;
    }
  | {
      kind: "delete-local";
      serverRevision: number;
    }
  | {
      kind: "keep-local";
      pendingMutation: ScheduleOutboxMutation;
      serverRevision: number;
    }
  | {
      kind: "conflict";
      local?: ScheduleCourse;
      remote?: ScheduleCourse;
      pendingMutation: ScheduleOutboxMutation;
      serverRevision: number;
    }
  | {
      kind: "no-change";
      serverRevision: number;
    }
  | {
      kind: "invalid-cloud-payload";
      courseId: string;
    }
  | {
      kind: "invalid-cloud-row";
      courseId: string;
    };

export type SyncStatus =
  | { kind: "guest" }
  | { kind: "saved"; lastSyncedAt: string }
  | { kind: "syncing"; pending: number }
  | { kind: "offline"; pending: number }
  | { kind: "pending"; pending: number }
  | { kind: "needs-review"; conflicts: number }
  | { kind: "auth-required"; pending: number }
  | { kind: "error"; message: string; pending: number };

export type ScheduleSyncReducerState = {
  accountId?: string;
  online: boolean;
  authExpired: boolean;
  pushing: boolean;
  failed: boolean;
  pending: number;
  conflicts: number;
  generation: number;
  lastRunToken: number;
  activeRunToken?: number;
  lastSyncedAt?: string;
};

type ScopedSyncRunEvent = {
  accountId: string;
  generation: number;
  runToken: number;
};

export type ScheduleSyncEvent =
  | {
      type: "AUTH_CHANGED";
      accountId: string | undefined;
      pending: number;
      conflicts: number;
      lastSyncedAt?: string;
    }
  | { type: "ONLINE" }
  | { type: "OFFLINE"; pending?: number }
  | ({ type: "PUSH_STARTED" } & ScopedSyncRunEvent)
  | ({
      type: "PUSH_ACKNOWLEDGED";
      pending: number;
      lastSyncedAt: string;
    } & ScopedSyncRunEvent)
  | ({
      type: "PULL_APPLIED";
      pending: number;
      conflicts: number;
      lastSyncedAt: string;
    } & ScopedSyncRunEvent)
  | ({ type: "CONFLICT"; conflicts: number } & ScopedSyncRunEvent)
  | { type: "AUTH_EXPIRED" }
  | ({ type: "FAILED" } & ScopedSyncRunEvent);
