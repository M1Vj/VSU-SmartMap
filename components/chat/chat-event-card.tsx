"use client";

import { Calendar, MapPin } from "lucide-react";

interface EventCardData {
  eventId: string;
  title: string;
  startTime: string;
  endTime: string;
  locationText?: string;
  category: string;
}

interface ChatEventCardProps {
  event: EventCardData;
}

const EVENT_CATEGORY_COLORS: Record<string, string> = {
  academic: "#3b82f6",
  sports: "#10b981",
  cultural: "#f59e0b",
  religious: "#8b5cf6",
  other: "#6b7280",
};

const formatEventTime = (startTime: string, endTime: string): string => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const now = new Date();
  
  const isToday = start.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = start.toDateString() === tomorrow.toDateString();
  
  const timeFormat: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  
  const dateFormat: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  
  const startTimeStr = start.toLocaleTimeString("en-US", timeFormat);
  const endTimeStr = end.toLocaleTimeString("en-US", timeFormat);
  
  if (isToday) {
    return `Today, ${startTimeStr} - ${endTimeStr}`;
  } else if (isTomorrow) {
    return `Tomorrow, ${startTimeStr} - ${endTimeStr}`;
  } else {
    const dateStr = start.toLocaleDateString("en-US", dateFormat);
    return `${dateStr}, ${startTimeStr} - ${endTimeStr}`;
  }
};

export function ChatEventCard({ event }: ChatEventCardProps) {
  const categoryColor = EVENT_CATEGORY_COLORS[event.category] || EVENT_CATEGORY_COLORS.other;

  return (
    <div className="flex w-60 flex-col gap-3 rounded-lg border bg-card/90 p-3 transition hover:border-primary/20">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${categoryColor}1a`, color: categoryColor }}
        >
          <Calendar className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <h4 className="truncate text-sm font-medium">{event.title}</h4>
          <p className="text-xs font-medium text-muted-foreground capitalize">
            {event.category}
          </p>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {formatEventTime(event.startTime, event.endTime)}
          </p>
          {event.locationText && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="line-clamp-1">{event.locationText}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
