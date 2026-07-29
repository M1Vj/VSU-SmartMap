"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { StoredScheduleConflict } from "@/lib/schedule/local-types";
import type { ScheduleScope } from "@/lib/schedule/scope";
import type { ReconciliationCandidate } from "@/lib/schedule/sync/types";
import { ScheduleConflictDialog } from "./schedule-conflict-dialog";

export function ScheduleOngoingReviewDialog({
  review,
  scope,
  busy,
  onResolve,
  onCancel,
}: {
  review?: StoredScheduleConflict;
  scope: ScheduleScope;
  busy: boolean;
  onResolve: (choice: "local" | "remote" | "discard-quarantine") => void;
  onCancel: () => void;
}) {
  if (!review) return null;
  if (review.reviewKind === "quarantine") {
    return (
      <ConfirmDialog
        open
        title="Review invalid cloud item"
        description="This cloud item could not be validated and was not shown in your schedule. You can discard this review notice without exposing its contents."
        confirmLabel="Discard invalid cloud item"
        loading={busy}
        onCancel={onCancel}
        onConfirm={() => onResolve("discard-quarantine")}
      />
    );
  }
  const versions: ReconciliationCandidate[] = [
    ...(review.local ? [{
      kind: "active" as const,
      source: "account-local" as const,
      course: review.local,
      revision: review.serverRevision,
    }] : []),
    ...(review.remote ? [{
      kind: "active" as const,
      source: "cloud" as const,
      course: review.remote,
      revision: review.serverRevision,
    }] : review.remoteDeleted ? [{
      kind: "tombstone" as const,
      source: "cloud" as const,
      courseId: review.courseId,
      revision: review.serverRevision,
    }] : []),
  ];
  return (
    <ScheduleConflictDialog
      open={!busy}
      scope={review.scope}
      activeScope={scope}
      courseId={review.courseId}
      versions={versions}
      onCancel={onCancel}
      onResolve={(resolution) => {
        if (resolution.kind !== "choose-source") return;
        onResolve(resolution.source === "cloud" ? "remote" : "local");
      }}
    />
  );
}
