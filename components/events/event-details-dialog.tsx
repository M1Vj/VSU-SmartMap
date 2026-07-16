"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Clock, MapPin } from "lucide-react";

import type { Event } from "@/lib/types/events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DialogScaffoldBody,
  DialogScaffoldContent,
  DialogScaffoldFooter,
  DialogScaffoldHeader,
} from "@/components/ui/dialog-scaffold";

interface EventDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event | null;
}

const CATEGORY_BADGE: Record<Event["category"], string> = {
  academic: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  sports: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  cultural: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  religious: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

export function EventDetailsDialog({ open, onOpenChange, event }: EventDetailsDialogProps) {
  const startDate = React.useMemo(() => (event ? new Date(event.startTime) : null), [event]);
  const endDate = React.useMemo(() => (event ? new Date(event.endTime) : null), [event]);
  const locationHref = React.useMemo(() => {
    if (!event) return null;
    if (event.locationId) return `/?facility=${event.locationId}`;
    if (event.locationText) return `/?q=${encodeURIComponent(event.locationText)}`;
    return null;
  }, [event]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogScaffoldContent className="sm:max-w-[560px]">
        <DialogScaffoldHeader>
          <DialogTitle className="flex items-start justify-between gap-3">
            <span className="min-w-0 truncate">{event?.title ?? "Event"}</span>
            {event && (
              <Badge className={CATEGORY_BADGE[event.category] ?? CATEGORY_BADGE.other}>
                {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>Event details</DialogDescription>
        </DialogScaffoldHeader>

        <DialogScaffoldBody>
          {!event ? (
            <div className="text-sm text-muted-foreground">No event selected.</div>
          ) : (
            <div className="space-y-4">
              {event.imageUrl && (
                <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              )}

              <div className="space-y-2 text-sm">
                {startDate && endDate && (
                  <>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        {format(startDate, "MMM d, yyyy")} · {format(startDate, "h:mm a")} -{" "}
                        {format(endDate, "h:mm a")}
                      </span>
                    </div>
                  </>
                )}

                {(event.locationText || event.locationId) && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    {locationHref ? (
                      <Link href={locationHref} className="break-words text-primary hover:underline">
                        {event.locationText || "View location"}
                      </Link>
                    ) : (
                      <span className="break-words">{event.locationText || "See map for location"}</span>
                    )}
                  </div>
                )}
              </div>

              {event.description && (
                <div className="rounded-md border bg-background p-3 text-sm leading-relaxed">
                  {event.description}
                </div>
              )}
            </div>
          )}
        </DialogScaffoldBody>

        <DialogScaffoldFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogScaffoldFooter>
      </DialogScaffoldContent>
    </Dialog>
  );
}
