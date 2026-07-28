"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { liveQuery } from "dexie";
import { useRouter } from "next/navigation";
import { CalendarDays, Database, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { getCachedFacilities, setCachedFacilities } from "@/lib/cache/facilities-cache";
import { getFacilitiesLite } from "@/lib/supabase/queries/facilities";
import type { Facility } from "@/lib/types";
import { ScheduleRepository } from "@/lib/schedule/repository";
import type { IsoWeekday, ScheduleCourse } from "@/lib/schedule/types";
import { DAY_LABELS, formatMinuteOfDay, getManilaWeekPosition, getNextClassOccurrence } from "@/lib/schedule/time";
import type { ScheduleBackupDocument } from "@/lib/schedule/backup";
import { CourseDialog } from "./course-dialog";
import { ScheduleAgenda } from "./schedule-agenda";
import { ScheduleWeekGrid } from "./schedule-week-grid";
import { ScheduleTransferDialog } from "./schedule-transfer-dialog";

const scheduleRepository = new ScheduleRepository();

type Confirmation =
  | { kind: "delete"; course: ScheduleCourse }
  | { kind: "clear" }
  | { kind: "restore"; backup: ScheduleBackupDocument };

export function SchedulePageClient() {
  const router = useRouter();
  const [courses, setCourses] = useState<ScheduleCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [liveFacilityIds, setLiveFacilityIds] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<IsoWeekday>(() => getManilaWeekPosition(new Date()).weekday);
  const [now, setNow] = useState(() => new Date());
  const [editing, setEditing] = useState<ScheduleCourse | null | undefined>();
  const [transferOpen, setTransferOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setStorageError("");
    const subscription = liveQuery(() => scheduleRepository.list()).subscribe({
      next(value) { setCourses(value); setLoading(false); },
      error(error) { setStorageError(error instanceof Error ? error.message : "The schedule could not be loaded."); setLoading(false); },
    });
    return () => subscription.unsubscribe();
  }, [reloadKey]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const cached = await getCachedFacilities();
      if (mounted && cached) setFacilities(cached);
      const result = await getFacilitiesLite();
      if (!mounted || result.error || !result.data) return;
      const refreshed = result.data as Facility[];
      setFacilities(refreshed);
      setLiveFacilityIds(new Set(refreshed.map((facility) => facility.id)));
      await setCachedFacilities(refreshed);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => { clearTimeout(timeout); if (interval) clearInterval(interval); };
  }, []);

  const next = useMemo(() => getNextClassOccurrence(courses, now), [courses, now]);
  const save = useCallback(async (value: unknown) => {
    setBusy(true);
    try {
      await scheduleRepository.put(value);
      toast.success(editing ? "Course updated" : "Course added");
      setEditing(undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save the course.");
      throw error;
    } finally {
      setBusy(false);
    }
  }, [editing]);

  const confirmAction = async () => {
    if (!confirmation) return;
    setBusy(true);
    try {
      if (confirmation.kind === "delete") {
        await scheduleRepository.remove(confirmation.course.id);
        toast.success("Course deleted");
      } else if (confirmation.kind === "clear") {
        await scheduleRepository.clear();
        toast.success("Schedule cleared");
      } else {
        await scheduleRepository.replaceAll(confirmation.backup.courses);
        toast.success(`Restored ${confirmation.backup.courses.length} courses`);
      }
      setConfirmation(undefined);
      setTransferOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The schedule could not be changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="h-full min-w-0 overflow-y-auto bg-background"
      aria-labelledby="schedule-page-heading"
    >
      <div className="mx-auto w-full max-w-7xl space-y-6 px-3 py-5 pb-28 sm:px-6 md:pb-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><h1 id="schedule-page-heading" className="text-2xl font-bold md:text-3xl">My Schedule</h1><p className="mt-1 text-muted-foreground">A private, offline-first weekly planner stored on this device.</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setTransferOpen(true)}><Database className="mr-2 h-4 w-4" />Backup & export</Button>{courses.length > 0 ? <Button variant="outline" onClick={() => setConfirmation({ kind: "clear" })}><Trash2 className="mr-2 h-4 w-4" />Clear</Button> : null}<Button onClick={() => setEditing(null)}><Plus className="mr-2 h-4 w-4" />Add course</Button></div>
        </header>

        {storageError ? <Card className="border-destructive"><CardHeader><CardTitle>Schedule storage unavailable</CardTitle></CardHeader><CardContent className="space-y-3"><p role="alert">{storageError}</p><Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>Try again</Button></CardContent></Card> : loading ? <Card><CardContent className="flex min-h-40 items-center justify-center p-6"><p aria-live="polite">Loading your schedule…</p></CardContent></Card> : (
          <>
            <Card>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>{next ? <><p className="text-sm font-medium text-muted-foreground">{next.isActive ? "Current class" : "Next class"}</p><h2 className="text-xl font-semibold">{next.course.code} · {next.course.title}</h2><p className="text-sm">{next.dayOffset === 0 ? "Today" : next.dayOffset === 1 ? "Tomorrow" : DAY_LABELS[next.weekday]}, {formatMinuteOfDay(next.startMinute)}–{formatMinuteOfDay(next.endMinute)} · {next.meeting.locationLabel || "TBA"}</p></> : <><p className="text-sm font-medium text-muted-foreground">Next class</p><h2 className="text-xl font-semibold">Nothing scheduled yet</h2><p className="text-sm text-muted-foreground">Add a meeting with a known time to see it here.</p></>}</div>
                {next?.meeting.facilityId && liveFacilityIds.has(next.meeting.facilityId) ? <Button variant="outline" onClick={() => router.push(`/?facility=${encodeURIComponent(next.meeting.facilityId!)}`)}>Open facility on map</Button> : null}
              </CardContent>
            </Card>
            {courses.length === 0 ? <Card className="border-dashed"><CardContent className="flex min-h-52 flex-col items-center justify-center p-6 text-center"><CalendarDays className="mb-3 h-9 w-9 text-muted-foreground" /><h2 className="text-lg font-semibold">Build your weekly plan</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Add courses, recurring times, campus facilities, free-text rooms, or TBA meetings.</p><Button className="mt-4" onClick={() => setEditing(null)}>Add your first course</Button></CardContent></Card> : null}
            <ScheduleAgenda courses={courses} selectedDay={selectedDay} onDayChange={setSelectedDay} onEdit={(course) => setEditing(course)} onDelete={(course) => setConfirmation({ kind: "delete", course })} onMap={(facilityId) => router.push(`/?facility=${encodeURIComponent(facilityId)}`)} isLiveFacility={(facilityId) => liveFacilityIds.has(facilityId)} />
            {courses.length > 0 ? <ScheduleWeekGrid courses={courses} /> : null}
          </>
        )}
        <aside className="flex gap-3 rounded-lg border bg-muted/40 p-4 text-sm"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p>Your class routine stays in this browser&apos;s IndexedDB. It is not synced to an account, sent to Supabase, placed in URLs, or stored in service-worker caches. Keep a JSON backup before clearing browser data or changing devices.</p></aside>
      </div>
      <CourseDialog open={editing !== undefined} course={editing ?? undefined} facilities={facilities} saving={busy} onClose={() => setEditing(undefined)} onSave={save} />
      <ScheduleTransferDialog open={transferOpen} courses={courses} busy={busy} onClose={() => setTransferOpen(false)} onRestoreReady={(backup) => setConfirmation({ kind: "restore", backup })} />
      <ConfirmDialog open={confirmation !== undefined} title={confirmation?.kind === "delete" ? `Delete ${confirmation.course.code}?` : confirmation?.kind === "restore" ? "Replace current schedule?" : "Clear the entire schedule?"} description={confirmation?.kind === "restore" ? `This validated backup contains ${confirmation.backup.courses.length} courses. Replacing is atomic, but it will overwrite the current local schedule.` : "This action changes only the schedule stored on this device."} confirmLabel={confirmation?.kind === "restore" ? "Replace schedule" : confirmation?.kind === "delete" ? "Delete course" : "Clear schedule"} loading={busy} onCancel={() => setConfirmation(undefined)} onConfirm={() => { void confirmAction(); }} />
    </div>
  );
}
