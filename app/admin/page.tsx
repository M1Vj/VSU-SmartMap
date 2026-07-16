import type { Metadata } from "next";
import { AdminBreadcrumbs } from '@/components/admin/admin-breadcrumbs';
import { QuickActions } from '@/components/admin/quick-actions';
import { RecentActivity } from '@/components/admin/recent-activity';
import { StatsCards } from '@/components/admin/stats-cards';
import { getAdminStats, getRecentSubmissions } from '@/lib/admin/dashboard';
import { EventsOverviewCard } from "@/components/admin/events-overview-card";
import { getEvents } from "@/lib/actions/events";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Dashboard | Campus SmartMap for VSU Admin",
  description: "Admin dashboard for Campus SmartMap for VSU.",
};

export default async function AdminDashboard() {
  const now = new Date();
  const inSevenDays = new Date(now);
  inSevenDays.setDate(inSevenDays.getDate() + 7);

  const [stats, submissions, eventsResult] = await Promise.all([
    getAdminStats(),
    getRecentSubmissions(10),
    getEvents({ startDate: now, endDate: inSevenDays }),
  ]);

  const events = eventsResult.data || [];
  const eventsErrorMessage = eventsResult.error?.message ?? null;

  return (
    <div className="space-y-6">
      <AdminBreadcrumbs />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of facilities, rooms, and submissions.
          </p>
        </div>
      </div>

      <StatsCards stats={stats} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <RecentActivity submissions={submissions} />
        </div>
        <div className="space-y-4">
          <QuickActions />
          <EventsOverviewCard
            events={events}
            pendingSuggestions={stats.pendingEventSuggestions}
            errorMessage={eventsErrorMessage}
          />
        </div>
      </div>
    </div>
  );
}
