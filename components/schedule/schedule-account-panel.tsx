"use client";

import type { RefObject } from "react";
import { Cloud, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScheduleAccountState } from "./use-schedule-account";
import type { SyncStatus } from "@/lib/schedule/sync/types";

const STATUS_LABEL: Record<Exclude<SyncStatus["kind"], "guest">, string> = {
  saved: "Saved",
  syncing: "Syncing",
  offline: "Offline",
  pending: "Changes pending",
  "needs-review": "Needs review",
  "auth-required": "Auth required",
  error: "Error",
};

export function ScheduleAccountPanel({
  enabled,
  account,
  consentEnabled,
  authError,
  syncStatus,
  onContinue,
  onEnable,
  onSyncNow,
  onReview,
  onSignOut,
  onBackup,
  onRemoveLocalData,
  privateSyncFocusRef,
}: {
  enabled: boolean;
  account: ScheduleAccountState;
  consentEnabled: boolean;
  authError?: string;
  syncStatus?: SyncStatus;
  onContinue: () => void;
  onEnable: () => void;
  onSyncNow?: () => void;
  onReview?: () => void;
  onSignOut: () => void;
  onBackup: () => void;
  onRemoveLocalData: () => void;
  privateSyncFocusRef?: RefObject<HTMLHeadingElement | null>;
}) {
  if (!enabled || account.kind === "guest") {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between [&_button]:min-h-11 [&_button]:min-w-11">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div><p className="font-medium">Stored only on this device</p><p className="text-sm text-muted-foreground">Private sync is optional. Your planner keeps working without an account.</p></div>
          </div>
          {enabled ? <Button type="button" variant="outline" onClick={onContinue}>Continue with Google</Button> : null}
          {authError ? <p role="alert" className="text-sm text-destructive">{authError}</p> : null}
        </CardContent>
      </Card>
    );
  }
  if (account.kind === "loading") {
    return <Card><CardContent className="p-5"><p aria-live="polite">Checking optional sync…</p></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          <h2
            ref={privateSyncFocusRef}
            tabIndex={-1}
            className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Cloud className="h-5 w-5" aria-hidden="true" />
            Private schedule sync
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 [&_button]:min-h-11 [&_button]:min-w-11">
        <div><p className="font-medium">{account.email ?? "Google account"}</p><p className="text-sm text-muted-foreground">When enabled, schedules use private Supabase rows and are not shared with Google or Google Calendar.</p></div>
        {!consentEnabled ? (
          <div className="space-y-2">
            <p className="text-sm">{account.offlineVerified ? "Signing in alone does not enable schedule sync." : "This cached account can use only its local schedule while offline. Reconnect and verify the account before enabling private sync."}</p>
            <Button type="button" onClick={onEnable} disabled={!account.offlineVerified}>Enable private sync</Button>
          </div>
        ) : (
          <div className="space-y-2" aria-live="polite">
            {syncStatus && syncStatus.kind !== "guest" ? (
              <>
                <p className="font-medium">{STATUS_LABEL[syncStatus.kind]}</p>
                {"pending" in syncStatus ? <p className="text-sm text-muted-foreground">{syncStatus.pending} pending change{syncStatus.pending === 1 ? "" : "s"}</p> : null}
                {"conflicts" in syncStatus ? <p className="text-sm text-muted-foreground">{syncStatus.conflicts} item{syncStatus.conflicts === 1 ? "" : "s"} need review</p> : null}
                {syncStatus.kind === "needs-review" && onReview ? <Button type="button" variant="outline" onClick={onReview}>Review items</Button> : null}
                {onSyncNow ? <Button type="button" variant="outline" onClick={onSyncNow}>Sync now</Button> : null}
              </>
            ) : <><p className="font-medium">Private sync enabled</p><p className="text-sm text-muted-foreground">{account.offlineVerified ? "Cloud sync status will appear here when synchronization starts." : "This device can use the account-local schedule, but cloud sync is paused until the account is verified online."}</p></>}
          </div>
        )}
        {authError ? <p role="alert" aria-live="assertive" className="text-sm text-destructive">{authError}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onBackup}>Backup & export</Button>
          <Button type="button" variant="outline" onClick={onSignOut}>Sign out</Button>
          <Button type="button" variant="destructive" onClick={onRemoveLocalData}>Remove local account data from this device</Button>
        </div>
      </CardContent>
    </Card>
  );
}
