import type { Metadata } from "next";
import { AdminBreadcrumbs } from '@/components/admin/admin-breadcrumbs';
import { NavigationEditor } from '@/components/admin/navigation/navigation-editor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Navigation | Campus SmartMap for VSU Admin",
  description: "Manage navigation nodes and edges used for campus routing.",
};

export default function NavigationPage() {
  return (
    <div className="space-y-6 h-full flex flex-col">
      <AdminBreadcrumbs />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Navigation & Pathfinding</h1>
          <p className="text-muted-foreground">
            Manage navigation nodes and routes for the campus map.
          </p>
        </div>
      </div>

      <NavigationEditor />
    </div>
  );
}
