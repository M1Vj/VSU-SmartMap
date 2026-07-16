import type { Metadata } from "next";

import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { LogsDashboard } from "@/components/admin/logs/logs-dashboard";
import { requireAdminSession } from "@/lib/auth/server";
import { listBugIncidents } from "@/lib/observability/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Logs & Incidents | Campus SmartMap for VSU Admin",
  description: "Review automatic logs, bug incidents, and export diagnostic context.",
};

export default async function AdminLogsPage() {
  await requireAdminSession();
  const incidents = await listBugIncidents({ limit: 100 });

  return (
    <div className="space-y-6">
      <AdminBreadcrumbs />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Logs & Incidents</h1>
          <p className="text-muted-foreground">
            Automatic error triage with recent context and exportable bug packets.
          </p>
        </div>
      </div>
      <LogsDashboard incidents={incidents} />
    </div>
  );
}
