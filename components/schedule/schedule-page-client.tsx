"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { liveQuery } from "dexie";
import { useRouter } from "next/navigation";
import { CalendarDays, Database, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useFacilitySearchData } from "@/components/facility/use-facility-search-data";
import { ScheduleRepository } from "@/lib/schedule/repository";
import type { ScheduleScope } from "@/lib/schedule/scope";
import { canRunScheduleScopeAction } from "@/lib/schedule/scope-bound-action";
import { isScheduleAccountSyncEnabled } from "@/lib/schedule/sync/feature-flag";
import {
  MAX_SCHEDULE_COURSES,
  type IsoWeekday,
  type ScheduleCourse,
} from "@/lib/schedule/types";
import { DAY_LABELS, formatMinuteOfDay, getManilaWeekPosition, getNextClassOccurrence } from "@/lib/schedule/time";
import type { ScheduleBackupDocument } from "@/lib/schedule/backup";
import {
  buildScheduleFacilitySearchOptions,
  reconcileKnownFacilityIds,
  transitionRestoreDialogs,
} from "@/lib/schedule/ui";
import { CourseDialog } from "./course-dialog";
import { ScheduleAgenda } from "./schedule-agenda";
import { ScheduleWeekGrid } from "./schedule-week-grid";
import { ScheduleTransferDialog } from "./schedule-transfer-dialog";
import { ScheduleAccountPanel } from "./schedule-account-panel";
import { ScheduleReconciliationDialog } from "./schedule-reconciliation-dialog";
import { useScheduleAccount } from "./use-schedule-account";
import { useScheduleReconciliation } from "./use-schedule-reconciliation";
import { useScheduleSync } from "./use-schedule-sync";

type Confirmation =
  | { kind: "delete"; course: ScheduleCourse; scope: ScheduleScope }
  | { kind: "clear"; scope: ScheduleScope }
  | { kind: "restore"; backup: ScheduleBackupDocument; scope: ScheduleScope }
  | { kind: "remove-local-account"; scope: ScheduleScope };

export function SchedulePageClient() {
  const router = useRouter();
  const accountSyncEnabled = isScheduleAccountSyncEnabled();
  const scheduleAccount = useScheduleAccount(accountSyncEnabled);
  const [loadedCourses, setLoadedCourses] = useState<{
    scope: ScheduleScope;
    courses: ScheduleCourse[];
  } | null>(null);
  const currentScopeRef = useRef(scheduleAccount.scope);
  const loadedScopeRef = useRef<ScheduleScope | undefined>(undefined);
  const actionGeneration = useRef(0);
  const reconciliationTriggerRef = useRef<HTMLButtonElement>(null);
  if (currentScopeRef.current !== scheduleAccount.scope) {
    currentScopeRef.current = scheduleAccount.scope;
    loadedScopeRef.current = undefined;
    actionGeneration.current += 1;
  }
  const courses = useMemo(
    () =>
      loadedCourses?.scope === scheduleAccount.scope
        ? loadedCourses.courses
        : [],
    [loadedCourses, scheduleAccount.scope],
  );
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [facilityQuery, setFacilityQuery] = useState("");
  const [deferredFacilityQuery, setDeferredFacilityQuery] = useState("");
  const {
    facilities,
    rooms,
    optionsQuery: facilityOptionsQuery,
    source: facilitySource,
    loading: facilitiesLoading,
    error: facilitiesError,
  } = useFacilitySearchData({
    enabled: true,
    query: deferredFacilityQuery,
  });
  const [selectedDay, setSelectedDay] = useState<IsoWeekday>(() => getManilaWeekPosition(new Date()).weekday);
  const [now, setNow] = useState(() => new Date());
  const [editing, setEditing] = useState<
    { scope: ScheduleScope; course: ScheduleCourse | null } | undefined
  >();
  const [transferScope, setTransferScope] = useState<ScheduleScope>();
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reconciliationApplied = useCallback(
    () => setReloadKey((key) => key + 1),
    [],
  );
  const scheduleReconciliation = useScheduleReconciliation({
    enabled: accountSyncEnabled,
    scope: scheduleAccount.scope,
    accountVerified:
      scheduleAccount.account.kind === "authenticated" &&
      scheduleAccount.account.offlineVerified,
    consentEnabled: scheduleAccount.consentEnabled,
    onApplied: reconciliationApplied,
  });
  const scheduleSync = useScheduleSync({
    enabled: accountSyncEnabled,
    scope: scheduleAccount.scope,
    authenticated: scheduleAccount.account.kind === "authenticated",
    offlineVerified:
      scheduleAccount.account.kind === "authenticated" &&
      scheduleAccount.account.offlineVerified,
    consentEnabled: scheduleAccount.consentEnabled,
    reconciliationVersion: reloadKey,
  });
  const scheduleRepository = useMemo(
    () => new ScheduleRepository(
      scheduleAccount.scope,
      undefined,
      undefined,
      scheduleSync.requestSync,
    ),
    [scheduleAccount.scope, scheduleSync.requestSync],
  );

  useEffect(() => {
    const timeout = setTimeout(() => setDeferredFacilityQuery(facilityQuery), 250);
    return () => clearTimeout(timeout);
  }, [facilityQuery]);

  useEffect(() => {
    setEditing(undefined);
    setConfirmation(undefined);
    setTransferScope(undefined);
    setFacilityQuery("");
    setDeferredFacilityQuery("");
    setBusy(false);
  }, [scheduleAccount.scope]);

  useEffect(() => {
    setLoading(true);
    setStorageError("");
    setLoadedCourses(null);
    const subscribedScope = scheduleAccount.scope;
    const subscription = liveQuery(() => scheduleRepository.list()).subscribe({
      next(value) {
        if (currentScopeRef.current !== subscribedScope) return;
        loadedScopeRef.current = subscribedScope;
        setLoadedCourses({ scope: subscribedScope, courses: value });
        setLoading(false);
      },
      error(error) {
        if (currentScopeRef.current !== subscribedScope) return;
        setStorageError(error instanceof Error ? error.message : "The schedule could not be loaded.");
        setLoading(false);
      },
    });
    return () => subscription.unsubscribe();
  }, [reloadKey, scheduleAccount.scope, scheduleRepository]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => { clearTimeout(timeout); if (interval) clearInterval(interval); };
  }, []);

  const next = useMemo(() => getNextClassOccurrence(courses, now), [courses, now]);
  const knownFacilityIds = useMemo(() => {
    const facilityIds = facilities.map((facility) => facility.id);
    return reconcileKnownFacilityIds(
      facilityIds,
      facilitySource === "remote" ? facilityIds : undefined,
    );
  }, [facilities, facilitySource]);
  const facilitySearchOptions = useMemo(
    () =>
      buildScheduleFacilitySearchOptions({
        facilities,
        rooms,
        query: facilityOptionsQuery,
      }),
    [facilities, facilityOptionsQuery, rooms],
  );
  const atCourseLimit = courses.length >= MAX_SCHEDULE_COURSES;
  const save = useCallback(async (value: unknown) => {
    const origin = editing?.scope;
    const operation = actionGeneration.current;
    if (
      !origin ||
      !canRunScheduleScopeAction(
        origin,
        currentScopeRef.current,
        loadedScopeRef.current,
      )
    ) {
      toast.error("The account changed. Reopen the schedule action and try again.");
      return;
    }
    setBusy(true);
    try {
      await scheduleRepository.put(value);
      if (
        operation !== actionGeneration.current ||
        origin !== currentScopeRef.current
      ) return;
      toast.success(
        scheduleAccount.scope === "guest"
          ? editing.course ? "Course updated on this device" : "Course added on this device"
          : "Saved on this device; sync queued",
      );
      setEditing(undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save the course.");
      throw error;
    } finally {
      if (operation === actionGeneration.current) setBusy(false);
    }
  }, [editing, scheduleAccount.scope, scheduleRepository]);

  const confirmAction = async () => {
    if (!confirmation) return;
    const origin = confirmation.scope;
    const operation = actionGeneration.current;
    if (
      !canRunScheduleScopeAction(
        origin,
        currentScopeRef.current,
        loadedScopeRef.current,
      )
    ) {
      toast.error("The account changed. Reopen the schedule action and try again.");
      return;
    }
    setBusy(true);
    try {
      if (confirmation.kind === "delete") {
        await scheduleRepository.remove(confirmation.course.id);
      } else if (confirmation.kind === "clear") {
        await scheduleRepository.clear();
      } else if (confirmation.kind === "restore") {
        await scheduleRepository.replaceAll(confirmation.backup.courses);
      } else {
        await scheduleAccount.removeLocalData(confirmation.scope);
      }
      if (
        operation !== actionGeneration.current ||
        origin !== currentScopeRef.current
      ) return;
      toast.success(
        confirmation.kind === "remove-local-account"
          ? "Local account schedule removed"
          : scheduleAccount.scope !== "guest"
            ? "Saved on this device; sync queued"
          : confirmation.kind === "delete"
            ? "Course deleted"
            : confirmation.kind === "clear"
              ? "Schedule cleared"
              : `Restored ${confirmation.backup.courses.length} courses`,
      );
      setConfirmation(undefined);
      setTransferScope(
        confirmation.kind === "restore"
          ? transitionRestoreDialogs("confirm", "confirmed") === "transfer"
            ? origin
            : undefined
          : undefined,
      );
    } catch (error) {
      if (operation === actionGeneration.current) {
        toast.error(error instanceof Error ? error.message : "The schedule could not be changed.");
      }
    } finally {
      if (operation === actionGeneration.current) setBusy(false);
    }
  };

  return (
    <div
      className="h-full min-w-0 overflow-y-auto bg-background [&_button]:min-h-11 [&_button]:min-w-11"
      aria-labelledby="schedule-page-heading"
    >
      <div className="mx-auto w-full max-w-7xl space-y-6 px-3 py-5 pb-28 sm:px-6 md:pb-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><h1 id="schedule-page-heading" className="text-2xl font-bold md:text-3xl">My Schedule</h1><p className="mt-1 text-muted-foreground">A private, offline-first weekly planner stored on this device.</p></div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => loadedScopeRef.current === scheduleAccount.scope && setTransferScope(scheduleAccount.scope)}><Database className="mr-2 h-4 w-4" />Backup & export</Button>{courses.length > 0 ? <Button variant="outline" onClick={() => setConfirmation({ kind: "clear", scope: scheduleAccount.scope })}><Trash2 className="mr-2 h-4 w-4" />Clear</Button> : null}<Button onClick={() => setEditing({ scope: scheduleAccount.scope, course: null })} disabled={atCourseLimit} aria-describedby={atCourseLimit ? "schedule-course-limit" : undefined}><Plus className="mr-2 h-4 w-4" />Add course</Button></div>
            {atCourseLimit ? <p id="schedule-course-limit" role="status" className="max-w-sm text-xs text-muted-foreground">This device has reached the {MAX_SCHEDULE_COURSES}-course schedule limit. Edit or delete a course before adding another.</p> : null}
          </div>
        </header>

        <ScheduleAccountPanel
          enabled={accountSyncEnabled}
          account={scheduleAccount.account}
          consentEnabled={scheduleAccount.consentEnabled}
          authError={scheduleAccount.authError}
          syncStatus={scheduleSync.status}
          onContinue={() => { void scheduleAccount.startGoogleSignIn(); }}
          onEnable={() => { void scheduleAccount.enableConsent(); }}
          onSyncNow={scheduleSync.syncNow}
          onSignOut={() => { void scheduleAccount.signOut(); }}
          onBackup={() => loadedScopeRef.current === scheduleAccount.scope && setTransferScope(scheduleAccount.scope)}
          onRemoveLocalData={() => setConfirmation({ kind: "remove-local-account", scope: scheduleAccount.scope })}
          reconciliationTriggerRef={reconciliationTriggerRef}
        />
        {scheduleReconciliation.error ? (
          <p role="alert" className="text-sm text-destructive">
            {scheduleReconciliation.error}
          </p>
        ) : null}

        {storageError ? <Card className="border-destructive"><CardHeader><CardTitle>Schedule storage unavailable</CardTitle></CardHeader><CardContent className="space-y-3"><p role="alert">{storageError}</p><Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>Try again</Button></CardContent></Card> : loading || scheduleAccount.account.kind === "loading" || loadedCourses?.scope !== scheduleAccount.scope ? <Card><CardContent className="flex min-h-40 items-center justify-center p-6"><p aria-live="polite">Loading your schedule…</p></CardContent></Card> : (
          <>
            <Card>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>{next ? <><p className="text-sm font-medium text-muted-foreground">{next.isActive ? "Current class" : "Next class"}</p><h2 className="text-xl font-semibold">{next.course.code} · {next.course.title}</h2><p className="text-sm">{next.dayOffset === 0 ? "Today" : next.dayOffset === 1 ? "Tomorrow" : DAY_LABELS[next.weekday]}, {formatMinuteOfDay(next.startMinute)}–{formatMinuteOfDay(next.endMinute)} · {next.meeting.locationLabel || "TBA"}</p></> : <><p className="text-sm font-medium text-muted-foreground">Next class</p><h2 className="text-xl font-semibold">Nothing scheduled yet</h2><p className="text-sm text-muted-foreground">Add a meeting with a known time to see it here.</p></>}</div>
                {next?.meeting.facilityId && knownFacilityIds.has(next.meeting.facilityId) ? <Button variant="outline" onClick={() => router.push(`/?facility=${encodeURIComponent(next.meeting.facilityId!)}`)}>Open facility on map</Button> : null}
              </CardContent>
            </Card>
            {courses.length === 0 ? <Card className="border-dashed"><CardContent className="flex min-h-52 flex-col items-center justify-center p-6 text-center"><CalendarDays className="mb-3 h-9 w-9 text-muted-foreground" /><h2 className="text-lg font-semibold">Build your weekly plan</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Add courses, recurring times, campus facilities, free-text rooms, or TBA meetings.</p><Button className="mt-4" onClick={() => setEditing({ scope: scheduleAccount.scope, course: null })}>Add your first course</Button></CardContent></Card> : null}
            <ScheduleAgenda courses={courses} selectedDay={selectedDay} onDayChange={setSelectedDay} onEdit={(course) => setEditing({ scope: scheduleAccount.scope, course })} onDelete={(course) => setConfirmation({ kind: "delete", course, scope: scheduleAccount.scope })} onMap={(facilityId) => router.push(`/?facility=${encodeURIComponent(facilityId)}`)} isLiveFacility={(facilityId) => knownFacilityIds.has(facilityId)} />
            {courses.length > 0 ? <ScheduleWeekGrid courses={courses} /> : null}
          </>
        )}
        <aside className="flex gap-3 rounded-lg border bg-muted/40 p-4 text-sm"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p>{scheduleAccount.account.kind !== "authenticated" ? "Your class routine stays in this browser’s IndexedDB and is not sent to Supabase. Keep a JSON backup before clearing browser data or changing devices." : !scheduleAccount.account.offlineVerified ? "This cached account’s local schedule is available only on this device while offline. Cloud sync stays paused until the account is verified online." : !scheduleAccount.consentEnabled ? "This account’s schedule remains local to this device. Signing in does not send it to Supabase unless you explicitly enable private sync." : "Private sync consent is enabled. Your schedule remains available locally; cloud activity and success are shown only when a verified sync status is available."}</p></aside>
      </div>
      <CourseDialog
        open={editing?.scope === scheduleAccount.scope}
        course={editing?.course ?? undefined}
        facilities={facilities}
        facilityOptions={facilitySearchOptions}
        facilityOptionsQuery={facilityOptionsQuery}
        facilitySource={facilitySource}
        facilitiesLoading={facilitiesLoading}
        facilitiesError={facilitiesError}
        saving={busy}
        onFacilityQueryChange={setFacilityQuery}
        onClose={() => {
          setFacilityQuery("");
          setEditing(undefined);
        }}
        onSave={save}
      />
      <ScheduleTransferDialog open={transferScope === scheduleAccount.scope && loadedCourses?.scope === scheduleAccount.scope} courses={courses} busy={busy} onClose={() => setTransferScope(undefined)} onRestoreReady={(backup) => { const origin = transferScope; if (!origin || !canRunScheduleScopeAction(origin, currentScopeRef.current, loadedScopeRef.current)) { toast.error("The account changed. Reopen the schedule action and try again."); return; } setTransferScope(transitionRestoreDialogs("transfer", "restore-ready") === "transfer" ? origin : undefined); setConfirmation({ kind: "restore", backup, scope: origin }); }} />
      <ConfirmDialog contentClassName="[&_button]:min-h-11 [&_button]:min-w-11" open={confirmation?.scope === scheduleAccount.scope} title={confirmation?.kind === "delete" ? `Delete ${confirmation.course.code}?` : confirmation?.kind === "restore" ? "Replace current schedule?" : confirmation?.kind === "remove-local-account" ? "Remove this account schedule from this device?" : "Clear the entire schedule?"} description={confirmation?.kind === "restore" ? `This validated backup contains ${confirmation.backup.courses.length} courses. Replacing is atomic, but it will overwrite the current local schedule.` : confirmation?.kind === "remove-local-account" ? "This removes only this signed-in account’s local courses, pending changes, sync consent, and review items. It does not remove guest, other-account, or cloud data." : "This action changes only the schedule stored on this device."} confirmLabel={confirmation?.kind === "restore" ? "Replace schedule" : confirmation?.kind === "delete" ? "Delete course" : confirmation?.kind === "remove-local-account" ? "Remove local account data" : "Clear schedule"} loading={busy} onCancel={() => { const reopen = confirmation?.kind === "restore" && transitionRestoreDialogs("confirm", "cancel") === "transfer"; const origin = confirmation?.scope; setConfirmation(undefined); setTransferScope(reopen ? origin : undefined); }} onConfirm={() => { void confirmAction(); }} />
      {scheduleReconciliation.snapshot ? (
        <ScheduleReconciliationDialog
          open
          scope={scheduleAccount.scope}
          activeScope={scheduleAccount.scope}
          snapshot={scheduleReconciliation.snapshot}
          busy={scheduleReconciliation.busy}
          returnFocusRef={reconciliationTriggerRef}
          onCancel={scheduleReconciliation.cancel}
          onChoice={(choice) => {
            if (!scheduleReconciliation.busy) {
              void scheduleReconciliation.choose(choice);
            }
          }}
        />
      ) : null}
    </div>
  );
}
