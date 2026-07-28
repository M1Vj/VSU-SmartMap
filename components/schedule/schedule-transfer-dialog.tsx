"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DialogScaffoldBody, DialogScaffoldContent, DialogScaffoldFooter, DialogScaffoldHeader } from "@/components/ui/dialog-scaffold";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assertScheduleFileSize } from "@/lib/schedule/ui";
import { exportScheduleBackup, parseScheduleBackup, type ScheduleBackupDocument } from "@/lib/schedule/backup";
import { exportScheduleIcs } from "@/lib/schedule/ics";
import type { ScheduleCourse } from "@/lib/schedule/types";

function download(contents: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ScheduleTransferDialog({
  open,
  courses,
  busy,
  onClose,
  onRestoreReady,
}: {
  open: boolean;
  courses: readonly ScheduleCourse[];
  busy: boolean;
  onClose: () => void;
  onRestoreReady: (backup: ScheduleBackupDocument) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [termStart, setTermStart] = useState(today);
  const [termEnd, setTermEnd] = useState(today);
  const [error, setError] = useState("");

  const selectFile = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      assertScheduleFileSize(file.size);
      const backup = parseScheduleBackup(await file.text());
      onRestoreReady(backup);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to read this backup.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogScaffoldContent className="w-[calc(100%-1rem)] sm:max-w-lg">
        <DialogScaffoldHeader><DialogTitle>Backup and calendar</DialogTitle><DialogDescription>All files are created and read on this device.</DialogDescription></DialogScaffoldHeader>
        <DialogScaffoldBody className="space-y-6 px-4 sm:px-6">
          <section className="space-y-2"><h3 className="font-semibold">JSON backup</h3><p className="text-sm text-muted-foreground">Download a private copy or choose a backup to replace this schedule after confirmation.</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => download(exportScheduleBackup(courses), "vsu-smartmap-schedule.json", "application/json")}>Download JSON</Button><Label className="inline-flex h-10 cursor-pointer items-center rounded-md border px-4 text-sm font-medium">Choose backup<Input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { void selectFile(event.target.files?.[0]); event.target.value = ""; }} /></Label></div>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}</section>
          <section className="space-y-3"><h3 className="font-semibold">Calendar export</h3><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="term-start">Term start</Label><Input id="term-start" type="date" value={termStart} onChange={(event) => setTermStart(event.target.value)} /></div><div><Label htmlFor="term-end">Term end</Label><Input id="term-end" type="date" value={termEnd} onChange={(event) => setTermEnd(event.target.value)} /></div></div><Button type="button" variant="outline" onClick={() => { try { setError(""); download(exportScheduleIcs(courses, { termStart, termEnd, generatedAt: new Date() }), "vsu-smartmap-schedule.ics", "text/calendar;charset=utf-8"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to export calendar."); } }}>Download ICS</Button><p className="text-xs text-muted-foreground">TBA-only meetings are not included as timed calendar events.</p></section>
        </DialogScaffoldBody>
        <DialogScaffoldFooter className="px-4 sm:px-6"><Button type="button" onClick={onClose} disabled={busy}>Close</Button></DialogScaffoldFooter>
      </DialogScaffoldContent>
    </Dialog>
  );
}
