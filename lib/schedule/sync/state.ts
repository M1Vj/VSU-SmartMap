import type {
  ScheduleSyncEvent,
  ScheduleSyncReducerState,
  SyncStatus,
} from "./types";

const GENERIC_SYNC_ERROR = "Schedule sync failed. Try again.";

export const initialScheduleSyncState: ScheduleSyncReducerState = {
  online: true,
  authExpired: false,
  pushing: false,
  failed: false,
  pending: 0,
  conflicts: 0,
};

function count(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Schedule sync count is invalid.");
  }
  return value;
}

export function reduceScheduleSyncState(
  state: ScheduleSyncReducerState,
  event: ScheduleSyncEvent,
): ScheduleSyncReducerState {
  switch (event.type) {
    case "AUTH_CHANGED":
      return {
        ...(event.accountId ? { accountId: event.accountId } : {}),
        online: state.online,
        authExpired: false,
        pushing: false,
        failed: false,
        pending: count(event.pending),
        conflicts: count(event.conflicts),
        ...(event.lastSyncedAt ? { lastSyncedAt: event.lastSyncedAt } : {}),
      };
    case "ONLINE":
      return { ...state, online: true };
    case "OFFLINE":
      return {
        ...state,
        online: false,
        pushing: false,
        ...(event.pending === undefined ? {} : { pending: count(event.pending) }),
      };
    case "PUSH_STARTED":
      return { ...state, pushing: true, failed: false };
    case "PUSH_ACKNOWLEDGED":
      return {
        ...state,
        pushing: false,
        failed: false,
        pending: count(event.pending),
        lastSyncedAt: event.lastSyncedAt,
      };
    case "PULL_APPLIED":
      return {
        ...state,
        pushing: false,
        failed: false,
        pending: count(event.pending),
        conflicts: count(event.conflicts),
        lastSyncedAt: event.lastSyncedAt,
      };
    case "CONFLICT":
      return {
        ...state,
        pushing: false,
        conflicts: count(event.conflicts),
      };
    case "AUTH_EXPIRED":
      return { ...state, authExpired: true, pushing: false };
    case "FAILED":
      return { ...state, pushing: false, failed: true };
  }
}

export function scheduleSyncStatus(state: ScheduleSyncReducerState): SyncStatus {
  if (!state.accountId) return { kind: "guest" };
  if (state.authExpired) return { kind: "auth-required", pending: state.pending };
  if (!state.online) return { kind: "offline", pending: state.pending };
  if (state.conflicts > 0) {
    return { kind: "needs-review", conflicts: state.conflicts };
  }
  if (state.pushing) return { kind: "syncing", pending: state.pending };
  if (state.failed) {
    return {
      kind: "error",
      message: GENERIC_SYNC_ERROR,
      pending: state.pending,
    };
  }
  if (state.pending > 0) return { kind: "pending", pending: state.pending };
  if (state.lastSyncedAt) {
    return { kind: "saved", lastSyncedAt: state.lastSyncedAt };
  }
  return { kind: "pending", pending: 0 };
}
