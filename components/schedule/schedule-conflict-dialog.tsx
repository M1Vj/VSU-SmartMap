"use client";

import { useEffect, useState } from "react";
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
import type {
  PerCourseResolution,
  ReconciliationCandidate,
  ReconciliationSource,
} from "@/lib/schedule/sync/types";

const SOURCE_LABEL: Record<ReconciliationSource, string> = {
  guest: "Guest device",
  "account-local": "This device",
  cloud: "Cloud version",
};

export function ScheduleConflictDialog({
  open,
  scope,
  activeScope,
  courseId,
  versions,
  onResolve,
  onCancel,
}: {
  open: boolean;
  scope: ScheduleScope;
  activeScope: ScheduleScope;
  courseId: string;
  versions: readonly ReconciliationCandidate[];
  onResolve: (resolution: PerCourseResolution) => void;
  onCancel: () => void;
}) {
  const [selectedSource, setSelectedSource] =
    useState<ReconciliationSource | undefined>(undefined);

  useEffect(() => {
    setSelectedSource(undefined);
    if (open && scope !== activeScope) onCancel();
  }, [activeScope, courseId, onCancel, open, scope]);

  const selected = versions.find(
    (version) => version.source === selectedSource,
  );
  const localSafe = versions.some(
    (version) =>
      version.kind === "active" && version.source === "account-local",
  );
  const cloudSafe = versions.some((version) => version.source === "cloud");

  const resolve = (source: ReconciliationSource) => {
    if (!versions.some((version) => version.source === source)) return;
    onResolve({ kind: "choose-source", courseId, source });
  };

  return (
    <Dialog
      open={open && scope === activeScope}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogScaffoldContent
        className="w-[calc(100%-1rem)] sm:max-w-2xl"
      >
        <DialogScaffoldHeader>
          <DialogTitle>Review schedule conflict</DialogTitle>
          <DialogDescription>
            Choose the exact version to keep. No version is selected
            automatically.
          </DialogDescription>
        </DialogScaffoldHeader>
        <DialogScaffoldBody className="space-y-3">
          <fieldset className="space-y-3">
            <legend className="sr-only">Available course versions</legend>
            {versions.map((version) => {
              const key =
                version.kind === "tombstone"
                  ? `cloud-deleted-${version.revision}`
                  : `${version.source}-${version.revision ?? "local"}`;
              return (
                <label
                  key={key}
                  className="flex min-h-11 cursor-pointer gap-3 rounded-lg border p-4 has-[:checked]:border-primary"
                >
                  <input
                    type="radio"
                    name={`schedule-conflict-${courseId}`}
                    value={version.source}
                    checked={selectedSource === version.source}
                    onChange={() => setSelectedSource(version.source)}
                    className="mt-1 h-5 w-5"
                  />
                  <span className="min-w-0 space-y-2">
                    <span className="block font-medium">
                      {version.kind === "tombstone"
                        ? "Deleted in cloud"
                        : SOURCE_LABEL[version.source]}
                    </span>
                    {version.kind === "active" ? (
                      <>
                        <span className="block">
                          {version.course.code} — {version.course.title}
                        </span>
                        {version.course.meetings.length === 0 ? (
                          <span className="block text-sm text-muted-foreground">
                            No meeting times
                          </span>
                        ) : (
                          version.course.meetings.map((meeting) => (
                            <span
                              key={meeting.id}
                              className="block text-sm text-muted-foreground"
                            >
                              {formatWeekdays(meeting.days)}{" "}
                              {formatMinuteOfDay(meeting.startMinute)}–
                              {formatMinuteOfDay(meeting.endMinute)}
                              {" · "}
                              {meeting.locationLabel ?? "TBA"}
                            </span>
                          ))
                        )}
                      </>
                    ) : (
                      <span className="block text-sm text-muted-foreground">
                        The cloud record is an explicit deletion, not missing
                        data.
                      </span>
                    )}
                    {version.revision !== undefined ? (
                      <span className="block text-xs text-muted-foreground">
                        Server revision {version.revision}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </fieldset>
        </DialogScaffoldBody>
        <DialogScaffoldFooter className="[&_button]:min-h-11 [&_button]:min-w-11">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Not now
          </Button>
          {localSafe ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => resolve("account-local")}
            >
              Keep this device
            </Button>
          ) : null}
          {cloudSafe ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => resolve("cloud")}
            >
              {versions.some((version) => version.kind === "tombstone")
                ? "Keep cloud deletion"
                : "Keep cloud version"}
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={!selected}
            onClick={() => selectedSource && resolve(selectedSource)}
          >
            Use selected version
          </Button>
        </DialogScaffoldFooter>
      </DialogScaffoldContent>
    </Dialog>
  );
}
