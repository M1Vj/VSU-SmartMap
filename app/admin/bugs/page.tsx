import type { Metadata } from "next";
import { BugReportsTable } from "@/components/admin/bugs/bug-reports-table";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Bug Reports | Campus SmartMap for VSU Admin",
  description: "View and manage bug reports submitted by users.",
};

export default function BugReportsPage() {
  return (
    <div className="space-y-6">
      <AdminBreadcrumbs />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Bug Reports</h1>
          <p className="text-muted-foreground">
            View and manage bug reports submitted by users.
          </p>
        </div>
      </div>
      <BugReportsTable />
    </div>
  );
}
