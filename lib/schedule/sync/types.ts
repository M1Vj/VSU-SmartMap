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
        versions: ReconciliationVersion[];
      }>;
    }
  | {
      kind: "invalid";
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
  lastSyncedAt?: string;
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
  | { type: "PUSH_STARTED" }
  | {
      type: "PUSH_ACKNOWLEDGED";
      pending: number;
      lastSyncedAt: string;
    }
  | {
      type: "PULL_APPLIED";
      pending: number;
      conflicts: number;
      lastSyncedAt: string;
    }
  | { type: "CONFLICT"; conflicts: number }
  | { type: "AUTH_EXPIRED" }
  | { type: "FAILED" };
