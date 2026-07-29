"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DialogScaffoldBody,
  DialogScaffoldContent,
  DialogScaffoldFooter,
  DialogScaffoldHeader,
} from "@/components/ui/dialog-scaffold";
import type { ScheduleScope } from "@/lib/schedule/scope";
import { formatMinuteOfDay, formatWeekdays } from "@/lib/schedule/time";
import {
  validateReconciliationChoice,
  type ValidatedScheduleReconciliationSnapshot,
  type ChoiceValidation,
} from "@/lib/schedule/sync/resolution";
import type {
  PerCourseResolution,
  ReconciliationChoice,
  ReconciliationSource,
} from "@/lib/schedule/sync/types";
import { ScheduleConflictDialog } from "./schedule-conflict-dialog";
import {
  shouldResetReconciliationDialog,
  type ReconciliationDialogLifecycle,
} from "./schedule-reconciliation-dialog-state";

const SOURCE_LABEL: Record<ReconciliationSource, string> = {
  guest: "Guest device",
  "account-local": "This device",
  cloud: "Cloud version",
};

export type ReconciliationSourceCounts = Readonly<
  Record<ReconciliationSource, number>
>;

export function ScheduleReconciliationDialog({
  open,
  scope,
  activeScope,
  snapshot,
  busy = false,
  returnFocusRef,
  shouldRestoreFocusOnClose,
  onChoice,
  onCancel,
}: {
  open: boolean;
  scope: ScheduleScope;
  activeScope: ScheduleScope;
  snapshot: ValidatedScheduleReconciliationSnapshot;
  busy?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  shouldRestoreFocusOnClose?: () => boolean;
  onChoice: (choice: ReconciliationChoice) => void;
  onCancel: () => void;
}) {
  const initialFocus = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const lifecycleRef = useRef<ReconciliationDialogLifecycle | undefined>(
    undefined,
  );
  const [reviewing, setReviewing] = useState(false);
  const [destructiveConfirmation, setDestructiveConfirmation] = useState<
    "replace-cloud" | "use-cloud" | undefined
  >();
  const [choices, setChoices] = useState<
    Record<string, ReconciliationSource>
  >({});
  const [validation, setValidation] = useState<ChoiceValidation>();
  const [focusedConflictId, setFocusedConflictId] = useState<string | undefined>(
    undefined,
  );
  const reconciliation = snapshot.reconciliation;
  const sourceCounts: ReconciliationSourceCounts = {
    guest: snapshot.guest.length,
    "account-local": snapshot.accountLocal.length,
    cloud: snapshot.cloud.filter((candidate) => candidate.kind === "active").length,
  };

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const nextLifecycle = { open, scope, activeScope, snapshot };
    const previousLifecycle = lifecycleRef.current;
    lifecycleRef.current = nextLifecycle;
    if (
      previousLifecycle &&
      !shouldResetReconciliationDialog(previousLifecycle, nextLifecycle)
    ) {
      return;
    }
    setReviewing(false);
    setDestructiveConfirmation(undefined);
    setChoices({});
    setValidation(undefined);
    setFocusedConflictId(undefined);
    if (open && scope !== activeScope) onCancelRef.current();
  }, [activeScope, open, scope, snapshot]);

  const cancel = () => {
    setReviewing(false);
    setDestructiveConfirmation(undefined);
    setChoices({});
    setValidation(undefined);
    setFocusedConflictId(undefined);
    onCancel();
  };

  const submitReview = () => {
    const choice: ReconciliationChoice = {
      kind: "review-merge",
      choices,
    };
    const result = validateReconciliationChoice(reconciliation, choice);
    setValidation(result);
    if (result.kind === "valid") onChoice(choice);
  };

  return (
    <Dialog
      open={open && scope === activeScope}
      onOpenChange={(next) => {
        if (!next && !busy) cancel();
      }}
    >
      <DialogScaffoldContent
        className="w-[calc(100%-1rem)] sm:max-w-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          initialFocus.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (
            shouldRestoreFocusOnClose?.() === true &&
            returnFocusRef?.current
          ) {
            returnFocusRef.current.focus();
          }
        }}
      >
        <DialogScaffoldHeader>
          <DialogTitle>Choose how to start private sync</DialogTitle>
          <DialogDescription>
            Nothing is chosen by timestamps. Review the validated schedules and
            decide what this account should keep.
          </DialogDescription>
        </DialogScaffoldHeader>
        <DialogScaffoldBody className="space-y-4">
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(
              [
                ["guest", "Guest device"],
                ["account-local", "This device"],
                ["cloud", "Cloud"],
              ] as const
            ).map(([source, label]) => (
              <div key={source} className="rounded-lg border p-3">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="text-xl font-semibold">
                  {sourceCounts[source]} course
                  {sourceCounts[source] === 1 ? "" : "s"}
                </dd>
              </div>
            ))}
          </dl>

          {destructiveConfirmation ? (
            <section
              aria-labelledby="confirm-replacement-title"
              className="space-y-3 rounded-lg border border-destructive p-4"
            >
              <h3 id="confirm-replacement-title" className="font-semibold">
                Confirm {destructiveConfirmation === "use-cloud" ? "cloud schedule" : "replacement"}
              </h3>
              <p className="text-sm">
                {destructiveConfirmation === "use-cloud"
                  ? `Replace ${sourceCounts["account-local"]} account-local courses with ${sourceCounts.cloud} cloud courses? Guest courses remain unchanged.`
                  : `Replace ${sourceCounts.cloud} cloud courses with the combined guest and account-local device schedules? Divergent device versions must be reviewed first.`}
              </p>
              <div className="flex flex-wrap gap-2 [&_button]:min-h-11 [&_button]:min-w-11">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setDestructiveConfirmation(undefined)}
                >
                  Go back
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() =>
                    onChoice({ kind: destructiveConfirmation })
                  }
                >
                  {destructiveConfirmation === "use-cloud"
                    ? "Yes, use cloud schedule"
                    : "Yes, replace cloud"}
                </Button>
              </div>
            </section>
          ) : reviewing ? (
            <section className="space-y-4" aria-labelledby="merge-review-title">
              <div>
                <h3 id="merge-review-title" className="font-semibold">
                  Review divergent courses
                </h3>
                <p className="text-sm text-muted-foreground">
                  Distinct and identical courses retain the deterministic
                  validated result. Choose a source for every divergence.
                </p>
              </div>
              {(reconciliation.kind === "merge-ready"
                ? []
                : reconciliation.conflicts
              ).map((conflict) => (
                <fieldset
                  key={conflict.courseId}
                  className="space-y-2 rounded-lg border p-3"
                >
                  <legend className="px-1 font-medium">
                    Course {conflict.courseId}
                  </legend>
                  {conflict.versions.map((version) => (
                    <label
                      key={`${version.source}-${version.revision ?? "local"}`}
                      className="flex min-h-11 items-center gap-3 rounded-md border p-3 has-[:checked]:border-primary"
                    >
                      <input
                        type="radio"
                        name={`reconcile-${conflict.courseId}`}
                        value={version.source}
                        checked={choices[conflict.courseId] === version.source}
                        onChange={() =>
                          setChoices((current) => ({
                            ...current,
                            [conflict.courseId]: version.source,
                          }))
                        }
                        className="h-5 w-5"
                      />
                      <span className="space-y-1">
                        {version.kind === "tombstone"
                          ? `Deleted in cloud · revision ${version.revision}`
                          : `${SOURCE_LABEL[version.source]}: ${version.course.code} — ${version.course.title}`}
                        {version.kind === "active" ? (
                          <>
                            {version.course.meetings.map((meeting) => (
                              <span key={meeting.id} className="block text-sm text-muted-foreground">
                                {formatWeekdays(meeting.days)}{" "}
                                {formatMinuteOfDay(meeting.startMinute)}–
                                {formatMinuteOfDay(meeting.endMinute)} ·{" "}
                                {meeting.locationLabel ?? "TBA"}
                              </span>
                            ))}
                            {version.revision !== undefined ? (
                              <span className="block text-xs text-muted-foreground">
                                Server revision {version.revision}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </span>
                    </label>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setFocusedConflictId(conflict.courseId)}
                  >
                    Open focused comparison
                  </Button>
                </fieldset>
              ))}
              {reconciliation.kind === "invalid" ? (
                <p role="alert" className="text-sm text-destructive">
                  Invalid or quarantined cloud data and schedule limit issues
                  require review. They will not be rendered or applied.
                </p>
              ) : null}
              {validation && validation.kind !== "valid" ? (
                <p role="alert" className="text-sm text-destructive">
                  {validation.kind === "course-limit-exceeded"
                    ? "The resolved schedule exceeds the 200-course limit."
                    : "Choose a present source for every divergent course."}
                </p>
              ) : null}
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">
              Closing this dialog or choosing Not now writes nothing and leaves
              every source unchanged.
            </p>
          )}
        </DialogScaffoldBody>
        <DialogScaffoldFooter className="[&_button]:min-h-11 [&_button]:min-w-11">
          <Button type="button" variant="ghost" onClick={cancel} disabled={busy}>
            Not now
          </Button>
          {reviewing ? (
            <Button type="button" onClick={submitReview} disabled={busy}>
              Apply reviewed merge
            </Button>
          ) : !destructiveConfirmation ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setDestructiveConfirmation("use-cloud")}
              >
                Use cloud schedule
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => setDestructiveConfirmation("replace-cloud")}
              >
                Replace cloud with this device
              </Button>
              <Button
                ref={initialFocus}
                type="button"
                disabled={busy}
                onClick={() => setReviewing(true)}
              >
                Review and merge
              </Button>
            </>
          ) : null}
        </DialogScaffoldFooter>
      </DialogScaffoldContent>
      {focusedConflictId ? (
        <ScheduleConflictDialog
          open
          scope={scope}
          activeScope={activeScope}
          courseId={focusedConflictId}
          versions={
            (reconciliation.kind === "merge-ready"
              ? []
              : reconciliation.conflicts
            ).find(({ courseId }) => courseId === focusedConflictId)?.versions ?? []
          }
          onResolve={(resolution: PerCourseResolution) => {
            if (resolution.kind === "choose-source") {
              setChoices((current) => ({
                ...current,
                [resolution.courseId]: resolution.source,
              }));
            }
            setFocusedConflictId(undefined);
          }}
          onCancel={() => setFocusedConflictId(undefined)}
        />
      ) : null}
    </Dialog>
  );
}
