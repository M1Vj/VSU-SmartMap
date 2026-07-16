"use client";

import * as React from "react";
import { LayoutList, Calendar as CalendarIcon } from "lucide-react";
import { SuggestEventDialog } from "@/components/events/suggest-event-dialog";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventCard } from "@/components/events/event-card";
import { EventCalendar } from "@/components/events/event-calendar";
import { EventFilters } from "@/components/events/event-filters";
import { getUpcomingEvents } from "@/lib/events/upcoming";
import type { Event } from "@/lib/types/events";

interface EventsViewProps {
  events: Event[];
}

export function EventsView({ events }: EventsViewProps) {
  const [activeTab, setActiveTab] = React.useState<"calendar" | "list">("calendar");

  const upcomingEvents = React.useMemo(() => getUpcomingEvents(events), [events]);
  const visibleCount = upcomingEvents.length;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 px-1 sm:px-0">
        <EventFilters />
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "calendar" | "list")} className="w-full">
        <div className="mb-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between sm:px-0">
          <h2 className="min-w-0 truncate text-lg font-semibold tracking-tight sm:text-xl">
            {visibleCount} {visibleCount === 1 ? "Event" : "Events"} Found
          </h2>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <TabsList className="grid h-11 w-full grid-cols-2 sm:w-[240px]">
              <TabsTrigger value="calendar" className="h-9 text-xs sm:text-sm">
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5 sm:mr-2" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="list" className="h-9 text-xs sm:text-sm">
                <LayoutList className="mr-1.5 h-3.5 w-3.5 sm:mr-2" />
                List
              </TabsTrigger>
            </TabsList>
            <SuggestEventDialog />
          </div>
        </div>

        <TabsContent value="list" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
            {upcomingEvents.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
                No events match your criteria.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          {upcomingEvents.length === 0 && (
            <div className="rounded-lg bg-muted/30 py-6 text-center text-muted-foreground">
              No upcoming events yet — check back soon or suggest one.
            </div>
          )}
          <EventCalendar events={upcomingEvents} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
