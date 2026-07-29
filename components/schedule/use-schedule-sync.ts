"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { db } from "@/lib/db";
import type { StoredScheduleConflict } from "@/lib/schedule/local-types";
import { GUEST_SCHEDULE_SCOPE, type ScheduleScope } from "@/lib/schedule/scope";
import { SupabaseScheduleGateway } from "@/lib/schedule/sync/cloud-gateway";
import { ScheduleSyncCoordinator, type SyncRunResult } from "@/lib/schedule/sync/coordinator";
import { createDexieScheduleSyncLocalStore, resolveDexieScheduleReview } from "@/lib/schedule/sync/dexie-sync-store";
import { createScheduleSyncRuntimeController, type ScheduleSyncRuntimeController } from "@/lib/schedule/sync/runtime-controller";
import {
  initialScheduleSyncState,
  reduceScheduleSyncState,
  scheduleSyncStatus,
} from "@/lib/schedule/sync/state";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export function useScheduleSync(input: {
  enabled: boolean;
  scope: ScheduleScope;
  authenticated: boolean;
  offlineVerified: boolean;
  consentEnabled: boolean;
  reconciliationVersion: number;
}) {
  const [state, dispatch] = useReducer(reduceScheduleSyncState, initialScheduleSyncState);
  const [quarantined, setQuarantined] = useState(0);
  const [review, setReview] = useState<StoredScheduleConflict>();
  const [reviewBusy, setReviewBusy] = useState(false);
  const runtime = useRef<ScheduleSyncRuntimeController | undefined>(undefined);
  const generationRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const quarantinedRef = useRef(quarantined);
  quarantinedRef.current = quarantined;

  useEffect(() => {
    runtime.current?.dispose();
    runtime.current = undefined;
    let alive = true;
    const generation = ++generationRef.current;
    const accountId =
      input.scope === GUEST_SCHEDULE_SCOPE ? undefined : input.scope.slice(5);
    void (async () => {
      const prior = stateRef.current;
      const sameAccount = prior.accountId === accountId;
      const [syncState, pending, review] = accountId
        ? await Promise.all([
            db.schedule_sync_state.get(input.scope).catch(() => undefined),
            db.schedule_outbox.where("scope").equals(input.scope).count()
              .catch(() => sameAccount ? prior.pending : 0),
            db.schedule_conflicts.where("scope").equals(input.scope).toArray()
              .then((rows) => ({
                conflicts: rows.filter((row) => row.reviewKind !== "quarantine").length,
                quarantined: rows.filter((row) => row.reviewKind === "quarantine").length,
              }))
              .catch(() => ({
                conflicts: sameAccount ? Math.max(0, prior.conflicts - quarantinedRef.current) : 0,
                quarantined: sameAccount ? quarantinedRef.current : 0,
              })),
          ])
        : [undefined, 0, { conflicts: 0, quarantined: 0 }] as const;
      if (!alive) return;
      dispatch({
        type: "AUTH_CHANGED",
        accountId,
        generation,
        pending,
        conflicts: review.conflicts + review.quarantined,
        ...(syncState?.lastSuccessfulSyncAt
          ? { lastSyncedAt: syncState.lastSuccessfulSyncAt }
          : {}),
      });
      setQuarantined(review.quarantined);
      const reconciled = syncState?.reconciliationCompleted === true;
      if (
        !input.enabled ||
        !input.authenticated ||
        !input.offlineVerified ||
        !input.consentEnabled ||
        !reconciled ||
        !accountId
      ) return;
      const localStore = createDexieScheduleSyncLocalStore(db);
      const onResult = (result: SyncRunResult) => {
        if (result.kind === "offline") {
          dispatch({ type: "OFFLINE" });
          return;
        }
        if (
          !("runToken" in result) ||
          typeof result.runToken !== "number" ||
          !accountId
        ) return;
        if (result.kind === "synced" || result.kind === "pending") {
          const now = new Date().toISOString();
          dispatch({
            type: "PULL_APPLIED",
            accountId,
            generation,
            runToken: result.runToken,
            pending: result.pending,
            conflicts: 0,
            lastSyncedAt: now,
          });
          void db.schedule_sync_state.update(input.scope, {
            lastSuccessfulSyncAt: now,
            lastError: undefined,
          });
        } else if (result.kind === "needs-review") {
          setQuarantined(result.quarantined);
          dispatch({
            type: "CONFLICT",
            accountId,
            generation,
            runToken: result.runToken,
            conflicts: result.conflicts + result.quarantined,
          });
        } else if (result.kind === "auth-required") {
          dispatch({ type: "AUTH_EXPIRED", accountId, generation, runToken: result.runToken });
        } else if (result.kind === "failed") {
          dispatch({ type: "FAILED", accountId, generation, runToken: result.runToken });
          void db.schedule_sync_state.update(input.scope, { lastError: "sync-failed" });
        }
      };
      const next = createScheduleSyncRuntimeController({
        scope: input.scope,
        enabled: input.enabled,
        authenticated: input.authenticated,
        offlineVerified: input.offlineVerified,
        consent: input.consentEnabled,
        reconciled,
        createCoordinator: () =>
          new ScheduleSyncCoordinator({
            store: localStore,
            gateway: new SupabaseScheduleGateway(getSupabaseBrowserClient()),
            consent: () => input.consentEnabled,
            online: () => navigator.onLine,
            cloudVerified: () => input.offlineVerified,
            onRunStarted: (_scope, runToken) => {
              dispatch({
                type: "PUSH_STARTED",
                accountId,
                generation,
                runToken,
              });
            },
          }),
        onResult,
        onOnlineChanged: (online) =>
          dispatch({ type: online ? "ONLINE" : "OFFLINE" }),
        eventTarget: window,
        documentTarget: document,
      });
      if (!alive) {
        next.dispose();
        return;
      }
      runtime.current = next;
      next.start();
    })().catch(() => undefined);
    return () => {
      alive = false;
      runtime.current?.dispose();
      runtime.current = undefined;
    };
  }, [
    input.authenticated,
    input.consentEnabled,
    input.enabled,
    input.offlineVerified,
    input.reconciliationVersion,
    input.scope,
  ]);

  const requestSync = useCallback((scope: ScheduleScope) => {
    if (scope === input.scope && scope !== GUEST_SCHEDULE_SCOPE) {
      runtime.current?.requestSync();
    }
  }, [input.scope]);
  const syncNow = useCallback(() => runtime.current?.syncNow(), []);
  const openReview = useCallback(() => {
    void db.schedule_conflicts.where("scope").equals(input.scope).sortBy("key")
      .then((rows) => setReview(rows[0]));
  }, [input.scope]);
  const closeReview = useCallback(() => setReview(undefined), []);
  const resolveReview = useCallback(async (
    choice: "local" | "remote" | "discard-quarantine",
  ) => {
    if (!review || review.scope !== input.scope) return;
    setReviewBusy(true);
    try {
      await resolveDexieScheduleReview(db, input.scope, review.key, choice);
      setReview(undefined);
      runtime.current?.requestSync();
    } finally {
      setReviewBusy(false);
    }
  }, [input.scope, review]);

  return {
    status: scheduleSyncStatus(state),
    pending: state.pending,
    conflicts: Math.max(0, state.conflicts - quarantined),
    quarantined,
    requestSync,
    syncNow,
    review,
    reviewBusy,
    openReview,
    closeReview,
    resolveReview,
  };
}
