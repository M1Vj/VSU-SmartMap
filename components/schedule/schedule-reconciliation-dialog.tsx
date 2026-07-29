"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  validateReconciliationChoice,
  type ChoiceValidation,
} from "@/lib/schedule/sync/resolution";
import type {
  ReconciliationChoice,
  ReconciliationSource,
  ScheduleSourceReconciliation,
} from "@/lib/schedule/sync/types";

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
  reconciliation,
  sourceCounts,
  onChoice,
  onCancel,
}: {
  open: boolean;
  scope: ScheduleScope;
  activeScope: ScheduleScope;
  reconciliation: ScheduleSourceReconciliation;
  sourceCounts: ReconciliationSourceCounts;
  onChoice: (choice: ReconciliationChoice) => void;
  onCancel: () => void;
}) {
  const initialFocus = useRef<HTMLButtonElement>(null);
  const [reviewing, setReviewing] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [choices, setChoices] = useState<
    Record<string, ReconciliationSource>
  >({});
  const [validation, setValidation] = useState<ChoiceValidation>();

  useEffect(() => {
    setReviewing(false);
    setConfirmReplace(false);
    setChoices({});
    setValidation(undefined);
    if (open && scope !== activeScope) onCancel();
  }, [activeScope, onCancel, open, scope]);

  const cancel = () => {
    setReviewing(false);
    setConfirmReplace(false);
    setChoices({});
    setValidation(undefined);
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
        if (!next) cancel();
      }}
    >
      <DialogScaffoldContent
        className="w-[calc(100%-1rem)] sm:max-w-2xl"
        aria-describedby="schedule-reconciliation-description"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          initialFocus.current?.focus();
        }}
      >
        <DialogScaffoldHeader>
          <DialogTitle>Choose how to start private sync</DialogTitle>
          <DialogDescription id="schedule-reconciliation-description">
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

          {confirmReplace ? (
            <section
              aria-labelledby="confirm-replacement-title"
              className="space-y-3 rounded-lg border border-destructive p-4"
            >
              <h3 id="confirm-replacement-title" className="font-semibold">
                Confirm replacement
              </h3>
              <p className="text-sm">
                Replace {sourceCounts.cloud} cloud course
                {sourceCounts.cloud === 1 ? "" : "s"} with this device’s
                schedule? This creates an explicit bounded set of cloud changes.
              </p>
              <div className="flex flex-wrap gap-2 [&_button]:min-h-11 [&_button]:min-w-11">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmReplace(false)}
                >
                  Go back
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => onChoice({ kind: "replace-cloud" })}
                >
                  Yes, replace cloud
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
                      <span>
                        {version.kind === "tombstone"
                          ? "Deleted in cloud"
                          : `${SOURCE_LABEL[version.source]}: ${version.course.code} — ${version.course.title}`}
                      </span>
                    </label>
                  ))}
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
          <Button type="button" variant="ghost" onClick={cancel}>
            Not now
          </Button>
          {reviewing ? (
            <Button type="button" onClick={submitReview}>
              Apply reviewed merge
            </Button>
          ) : !confirmReplace ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onChoice({ kind: "use-cloud" })}
              >
                Use cloud schedule
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmReplace(true)}
              >
                Replace cloud with this device
              </Button>
              <Button
                ref={initialFocus}
                type="button"
                onClick={() => setReviewing(true)}
              >
                Review and merge
              </Button>
            </>
          ) : null}
        </DialogScaffoldFooter>
      </DialogScaffoldContent>
    </Dialog>
  );
}
