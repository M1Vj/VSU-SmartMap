import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Event } from "@/lib/types/events";
import { formatDateShortPH } from "@/lib/utils/date";

interface EventsOverviewCardProps {
  events: Event[];
  pendingSuggestions: number;
  errorMessage?: string | null;
}

export function EventsOverviewCard({
  events,
  pendingSuggestions,
  errorMessage,
}: EventsOverviewCardProps) {
  const upcoming = events.slice(0, 5);

  return (
    <Card className="border shadow-sm">
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" aria-hidden />
            Upcoming Events
          </CardTitle>
          {pendingSuggestions > 0 && (
            <Badge variant="destructive" className="rounded-full">
              {pendingSuggestions} pending
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Next events happening on campus. Manage published events and review suggestions.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {errorMessage && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive">Events are currently unavailable.</p>
            <p className="mt-1 text-xs text-muted-foreground">{errorMessage}</p>
          </div>
        )}

        {!errorMessage && upcoming.length === 0 && (
          <p className="text-sm text-muted-foreground">No upcoming events found.</p>
        )}

        {!errorMessage && upcoming.length > 0 && (
          <div className="space-y-2">
            {upcoming.map((event) => (
              <div
                key={event.id}
                className="rounded-lg border bg-background p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateShortPH(event.startTime)}
                      {event.locationText ? ` • ${event.locationText}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize shrink-0">
                    {event.category}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button asChild variant="outline" className="w-full justify-between">
          <Link href="/admin/events">
            Manage events
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

