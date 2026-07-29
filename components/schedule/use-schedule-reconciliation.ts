"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import { defaultScheduleMutationDependencies } from "@/lib/schedule/outbox";
import { GUEST_SCHEDULE_SCOPE, type ScheduleScope } from "@/lib/schedule/scope";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { SupabaseScheduleGateway } from "@/lib/schedule/sync/cloud-gateway";
import {
  buildReconciliationResolutionPlan,
  createValidatedScheduleReconciliationSnapshot,
  type ValidatedScheduleReconciliationSnapshot,
} from "@/lib/schedule/sync/resolution";
import { createDexieAtomicScheduleResolutionStore } from "@/lib/schedule/sync/resolution-store";
import {
  applyScopedReconciliation,
  classifyFirstReconciliation,
  createReconciliationGeneration,
} from "@/lib/schedule/sync/reconciliation-controller";
import type { ReconciliationChoice } from "@/lib/schedule/sync/types";

const GENERIC_RECONCILIATION_ERROR =
  "Private schedule sync could not be prepared. Your schedules are unchanged.";
const MAX_INITIAL_CLOUD_ROWS = 1_000;

export function useScheduleReconciliation({
  enabled,
  scope,
  accountVerified,
  consentEnabled,
  onApplied,
}: {
  enabled: boolean;
  scope: ScheduleScope;
  accountVerified: boolean;
  consentEnabled: boolean;
  onApplied: () => void;
}) {
  const gate = useRef(createReconciliationGeneration());
  const deferredScope = useRef<ScheduleScope | undefined>(undefined);
  const [snapshotState, setSnapshotState] = useState<{
    scope: ScheduleScope;
    snapshot: ValidatedScheduleReconciliationSnapshot;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    gate.current.invalidate();
    setSnapshotState(undefined);
    setBusy(false);
    setError("");
    if (
      !enabled ||
      !accountVerified ||
      !consentEnabled ||
      scope === GUEST_SCHEDULE_SCOPE ||
      deferredScope.current === scope
    ) {
      return;
    }
    const generationGate = gate.current;
    const token = generationGate.begin(scope);
    let alive = true;
    setBusy(true);
    void (async () => {
      try {
        const state = await db.schedule_sync_state.get(scope);
        if (state?.reconciliationCompleted === true) return;
        const [guestRows, accountRows, cloud] = await Promise.all([
          db.schedule_scoped_courses
            .where("scope")
            .equals(GUEST_SCHEDULE_SCOPE)
            .toArray(),
          db.schedule_scoped_courses.where("scope").equals(scope).toArray(),
          new SupabaseScheduleGateway(
            getSupabaseBrowserClient(),
            scope.slice("user:".length),
          ).pullAllBounded(MAX_INITIAL_CLOUD_ROWS),
        ]);
        if (cloud.length > MAX_INITIAL_CLOUD_ROWS) {
          throw new Error("Initial cloud schedule is unbounded.");
        }
        const snapshot = createValidatedScheduleReconciliationSnapshot({
          guest: guestRows.map(({ course }) => course),
          accountLocal: accountRows.map(({ course, serverRevision }) => ({
            course,
            ...(serverRevision === undefined ? {} : { serverRevision }),
          })),
          cloud,
        });
        if (!alive || !generationGate.isCurrent(token, scope)) return;
        const disposition = classifyFirstReconciliation(snapshot);
        if (disposition === "blocked") {
          setError(GENERIC_RECONCILIATION_ERROR);
          return;
        }
        if (disposition === "complete-empty") {
          const result = buildReconciliationResolutionPlan({
            scope,
            snapshot,
            choice: { kind: "use-cloud" },
          });
          if (result.kind !== "ready") throw new Error("Invalid empty plan.");
          await createDexieAtomicScheduleResolutionStore(
            db,
            defaultScheduleMutationDependencies,
          ).apply(result.plan);
          if (alive && generationGate.isCurrent(token, scope)) onApplied();
          return;
        }
        setSnapshotState({ scope, snapshot });
      } catch {
        if (alive && generationGate.isCurrent(token, scope)) {
          setError(GENERIC_RECONCILIATION_ERROR);
        }
      } finally {
        if (alive && generationGate.isCurrent(token, scope)) setBusy(false);
      }
    })();
    return () => {
      alive = false;
      generationGate.invalidate();
    };
  }, [accountVerified, consentEnabled, enabled, onApplied, scope]);

  const cancel = useCallback(() => {
    gate.current.invalidate();
    deferredScope.current = scope;
    setSnapshotState(undefined);
    setError("");
  }, [scope]);

  const choose = useCallback(
    async (choice: ReconciliationChoice): Promise<boolean> => {
      if (
        choice.kind === "cancel" ||
        !snapshotState ||
        snapshotState.scope !== scope
      ) {
        cancel();
        return false;
      }
      setBusy(true);
      setError("");
      try {
        const result = buildReconciliationResolutionPlan({
          scope,
          snapshot: snapshotState.snapshot,
          choice,
        });
        if (result.kind !== "ready") {
          throw new Error("Reconciliation choice requires review.");
        }
        return await applyScopedReconciliation({
          gate: gate.current,
          scope,
          apply: () =>
            createDexieAtomicScheduleResolutionStore(
              db,
              defaultScheduleMutationDependencies,
            ).apply(result.plan),
          onSuccess: () => {
            setSnapshotState(undefined);
            onApplied();
          },
          onFailure: () => {
            setError(GENERIC_RECONCILIATION_ERROR);
          },
          onFinally: () => {
            setBusy(false);
          },
        });
      } catch {
        setError(GENERIC_RECONCILIATION_ERROR);
        setBusy(false);
        return false;
      }
    },
    [cancel, onApplied, scope, snapshotState],
  );

  return {
    snapshot:
      snapshotState?.scope === scope ? snapshotState.snapshot : undefined,
    busy,
    error,
    cancel,
    choose,
  };
}
