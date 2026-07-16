import type { Metadata } from "next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventsTable } from "@/components/admin/events-table";
import { SuggestionsReviewTable } from "@/components/admin/suggestions-review-table";
import { AdminAddEventDialog } from "@/components/admin/admin-add-event-dialog";
import { getEvents, getEventSuggestions } from "@/lib/actions/events";
import { requireAdminSession } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Manage Events | Campus SmartMap for VSU Admin",
  description: "Admin dashboard for managing campus events and suggestions.",
};

export default async function AdminEventsPage() {
  await requireAdminSession();

  const [upcomingEventsResult, archivedEventsResult, suggestionsResult] = await Promise.all([
    getEvents({ timeframe: "upcoming" }),
    getEvents({ timeframe: "past" }),
    getEventSuggestions("pending"),
  ]);

  const upcomingEvents = upcomingEventsResult.data || [];
  const archivedEvents = archivedEventsResult.data || [];
  const suggestions = suggestionsResult.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Events Management</h1>
          <p className="text-muted-foreground text-sm">
            Review suggestions and manage published events.
          </p>
        </div>
        <AdminAddEventDialog />
      </div>

      <Tabs defaultValue="suggestions" className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="suggestions">
            Suggestions
            {suggestions && suggestions.length > 0 && (
              <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                {suggestions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="events">
            Upcoming
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {upcomingEvents.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="archived">
            Archived
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {archivedEvents.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="space-y-4 mt-4">
          <div className="bg-background rounded-lg border p-4">
            <h2 className="text-lg font-semibold mb-4">Pending Suggestions</h2>
            <SuggestionsReviewTable suggestions={suggestions || []} />
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-4 mt-4">
          <div className="bg-background rounded-lg border p-4">
            <h2 className="text-lg font-semibold mb-4">Upcoming Events</h2>
            <EventsTable
              events={upcomingEvents}
              emptyMessage="No upcoming events found."
            />
          </div>
        </TabsContent>

        <TabsContent value="archived" className="space-y-4 mt-4">
          <div className="bg-background rounded-lg border p-4">
            <h2 className="text-lg font-semibold mb-4">Archived Events</h2>
            <EventsTable
              events={archivedEvents}
              emptyMessage="No archived events found."
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
