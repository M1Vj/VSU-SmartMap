"use client";

import { useMemo, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Activity, AlertTriangle, Copy, Download, ExternalLink, FileJson, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateIncidentStatusAction } from "@/app/admin/logs/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IncidentStatus } from "@/lib/observability/logging";
import type { IncidentWithSample } from "@/lib/observability/server";

const SEVERITY_CLASS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_OPTIONS: IncidentStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

type LogsDashboardProps = {
  incidents: IncidentWithSample[];
};

export function LogsDashboard({ incidents }: LogsDashboardProps) {
  const [selectedId, setSelectedId] = useState(incidents[0]?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "ALL">("ALL");
  const [sourceFilter, setSourceFilter] = useState<"client" | "server" | "ALL">("ALL");
  const [isPending, startTransition] = useTransition();

  const filteredIncidents = useMemo(
    () =>
      incidents.filter((incident) => {
        if (statusFilter !== "ALL" && incident.status !== statusFilter) return false;
        if (sourceFilter !== "ALL" && incident.source !== sourceFilter) return false;
        return true;
      }),
    [incidents, sourceFilter, statusFilter],
  );

  const selectedIncident =
    filteredIncidents.find((incident) => incident.id === selectedId) ?? filteredIncidents[0] ?? null;

  const counts = useMemo(
    () => ({
      open: incidents.filter((incident) => incident.status === "OPEN").length,
      critical: incidents.filter((incident) => incident.severity === "CRITICAL").length,
      events: incidents.reduce((total, incident) => total + incident.eventCount, 0),
    }),
    [incidents],
  );

  const updateStatus = (incident: IncidentWithSample, status: IncidentStatus) => {
    startTransition(async () => {
      const result = await updateIncidentStatusAction(incident.id, status);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Incident status updated");
    });
  };

  const copySummary = async (incident: IncidentWithSample) => {
    const text = [
      `Title: ${incident.title}`,
      `Severity: ${incident.severity}`,
      `Status: ${incident.status}`,
      `Source: ${incident.source}`,
      `Route: ${incident.route ?? "unknown"}`,
      `Events: ${incident.eventCount}`,
      `Fingerprint: ${incident.fingerprint}`,
      `Summary: ${incident.summary ?? "No summary"}`,
      `Sample: ${incident.sampleMessage ?? "No sample message"}`,
    ].join("\n");

    await navigator.clipboard.writeText(text);
    toast.success("Incident summary copied");
  };

  if (incidents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border bg-card py-20 text-center text-muted-foreground">
        <Activity className="mb-4 h-12 w-12 opacity-30" />
        <p className="text-sm font-medium">No automatic incidents captured yet.</p>
        <p className="mt-1 max-w-md text-sm">
          Client and server errors will appear here after the observability migration is applied.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Open incidents
          </div>
          <p className="mt-2 text-2xl font-bold">{counts.open}</p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Critical incidents
          </div>
          <p className="mt-2 text-2xl font-bold">{counts.critical}</p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            Captured error events
          </div>
          <p className="mt-2 text-2xl font-bold">{counts.events}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3">
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as IncidentStatus | "ALL")}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as "client" | "server" | "ALL")}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All sources</SelectItem>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="server">Server</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/api/admin/logs/export?format=csv">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </a>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="overflow-hidden rounded-md border bg-card">
          <div className="border-b px-4 py-3 text-sm font-semibold">Incident queue</div>
          <div className="divide-y">
            {filteredIncidents.map((incident) => (
              <button
                key={incident.id}
                type="button"
                className={`block w-full px-4 py-3 text-left transition hover:bg-muted/60 ${
                  selectedIncident?.id === incident.id ? "bg-muted" : ""
                }`}
                onClick={() => setSelectedId(incident.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_CLASS[incident.severity]}`}>
                        {incident.severity}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium uppercase text-muted-foreground">
                        {incident.source}
                      </span>
                    </div>
                    <p className="truncate text-sm font-semibold">{incident.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {incident.route ?? "Unknown route"} · {incident.eventCount} event(s)
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(incident.lastSeenAt), { addSuffix: true })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border bg-card">
          {selectedIncident ? (
            <div className="space-y-5 p-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Selected incident</p>
                    <h2 className="mt-1 text-lg font-semibold leading-tight">{selectedIncident.title}</h2>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${SEVERITY_CLASS[selectedIncident.severity]}`}>
                    {selectedIncident.severity}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{selectedIncident.summary ?? "No summary captured."}</p>
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Route</p>
                  <p className="truncate font-medium">{selectedIncident.route ?? "Unknown"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Last seen</p>
                  <p className="font-medium">{formatDistanceToNow(new Date(selectedIncident.lastSeenAt), { addSuffix: true })}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Fingerprint</p>
                  <p className="truncate font-mono text-xs">{selectedIncident.fingerprint}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Sample event</p>
                  <p className="truncate font-mono text-xs">{selectedIncident.sampleEventId ?? "None"}</p>
                </div>
              </div>

              {selectedIncident.sampleMessage && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Sample message</p>
                  <pre className="max-h-44 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                    {selectedIncident.sampleMessage}
                  </pre>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Select
                  value={selectedIncident.status}
                  onValueChange={(value) => updateStatus(selectedIncident, value as IncidentStatus)}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-9 w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={() => copySummary(selectedIncident)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/admin/logs/export?format=json&incidentId=${selectedIncident.id}`}>
                    <FileJson className="mr-2 h-4 w-4" />
                    JSON
                  </a>
                </Button>
                {selectedIncident.route && (
                  <Button asChild variant="outline" size="sm">
                    <a href={selectedIncident.route} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open route
                    </a>
                  </Button>
                )}
                {isPending && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              </div>
            </div>
          ) : (
            <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
              Select an incident to inspect context.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
