"use client";

import Link from "next/link";
import { format } from "date-fns";
import { MapPin, Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Event } from "@/lib/types/events";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: Event;
  className?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  academic: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  sports: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  cultural: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  religious: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

export function EventCard({ event, className }: EventCardProps) {
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);

  const locationHref = event.locationId
    ? `/?facility=${event.locationId}`
    : event.locationText
      ? `/?q=${encodeURIComponent(event.locationText)}`
      : null;

  return (
    <Card className={cn("overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow", className)}>
      {event.imageUrl && (
        <div className="relative aspect-video w-full bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.imageUrl}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      )}
      
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 font-semibold text-lg line-clamp-2 leading-tight tracking-tight">
            {event.title}
          </h3>
          <Badge className={cn("hover:bg-opacity-80 border-0 shrink-0", CATEGORY_COLORS[event.category] || CATEGORY_COLORS.other)}>
            {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 py-2 flex-grow space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            {format(startDate, "MMM d, h:mm a")} - {format(endDate, "h:mm a")}
          </span>
        </div>
        
        {(event.locationText || event.locationId) && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
            {locationHref ? (
              <Link href={locationHref} className="line-clamp-2 text-primary hover:underline">
                {event.locationText || "View location"}
              </Link>
            ) : (
              <span className="line-clamp-2">
                {event.locationText || "See map for location"}
              </span>
            )}
          </div>
        )}
        
        {event.description && (
          <p className="mt-2 line-clamp-3 text-sm text-foreground/80">
            {event.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
