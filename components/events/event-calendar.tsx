"use client";

import * as React from "react";
import { Calendar, dateFnsLocalizer, View, Views } from "react-big-calendar";
import { addDays, differenceInMinutes, format, getDay, parse, startOfDay, startOfWeek } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DialogScaffoldBody,
  DialogScaffoldContent,
  DialogScaffoldFooter,
  DialogScaffoldHeader,
} from "@/components/ui/dialog-scaffold";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Event } from "@/lib/types/events";
import { cn } from "@/lib/utils";
import { EventDetailsDialog } from "@/components/events/event-details-dialog";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const CATEGORY_COLORS: Record<Event["category"], string> = {
  academic: "#3b82f6",
  sports: "#22c55e",
  cultural: "#a855f7",
  religious: "#f59e0b",
  other: "#6b7280",
};

interface EventCalendarProps {
  events: Event[];
  className?: string;
}

type GroupedEventResource = {
  kind: "group";
  events: Event[];
  category: Event["category"];
  locationId: Event["locationId"];
  locationText: Event["locationText"];
};

type CalendarEventResource = Event | GroupedEventResource;

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: CalendarEventResource;
}

type DayEventItem = {
  event: CalendarEvent;
  start: Date;
  end: Date;
  lane: number;
};

function isGroupedEventResource(resource: CalendarEventResource): resource is GroupedEventResource {
  return typeof resource === "object" && resource !== null && "kind" in resource && resource.kind === "group";
}

function AgendaEventCell({ event, title }: { event: CalendarEvent; title?: string }) {
  const resource = event.resource;
  const category = resource.category;
  const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
  const locationText = resource.locationText;

  return (
    <div className="flex items-start gap-2">
      <span
        aria-hidden
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div className="min-w-0">
        <div className="truncate font-medium">{title ?? event.title}</div>
        {locationText && (
          <div className="truncate text-xs text-muted-foreground">{locationText}</div>
        )}
      </div>
    </div>
  );
}

function GroupedEventsDialog({
  open,
  onOpenChange,
  group,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupedEventResource | null;
  onSelect: (event: Event) => void;
}) {
  const list = group?.events ?? [];

  const timeLabel = React.useMemo(() => {
    if (!group || group.events.length === 0) return null;
    const first = group.events[0];
    const start = new Date(first.startTime);
    const end = new Date(first.endTime);
    return `${format(start, "MMM d, yyyy")} · ${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
  }, [group]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogScaffoldContent className="sm:max-w-[640px]">
        <DialogScaffoldHeader>
          <DialogTitle className="flex items-start justify-between gap-3">
            <span className="min-w-0 truncate">
              {group ? `${list.length} events` : "Events"}
            </span>
            {group && (
              <Badge variant="outline" className="capitalize shrink-0">
                {group.category}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {timeLabel ?? "Select an event to view details."}
          </DialogDescription>
        </DialogScaffoldHeader>

        <DialogScaffoldBody>
          {list.length === 0 ? (
            <div className="text-sm text-muted-foreground">No events.</div>
          ) : (
            <div className="space-y-2">
              {list.map((event) => {
                const start = new Date(event.startTime);
                const end = new Date(event.endTime);
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="w-full rounded-md border bg-background p-3 text-left transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                    onClick={() => onSelect(event)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{event.title}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {format(start, "h:mm a")} - {format(end, "h:mm a")}
                          {event.locationText ? ` • ${event.locationText}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize shrink-0">
                        {event.category}
                      </Badge>
                    </div>
                  </button>
                );
              })}
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

const MINUTES_PER_DAY = 24 * 60;
const PX_PER_MINUTE = 2; // 1 hour = 120px
const EVENT_ROW_HEIGHT = 56;
const EVENT_PADDING_Y = 6;

const HorizontalDayView: any = (props: any) => {
  const date: Date = React.useMemo(
    () => (props?.date ? new Date(props.date) : new Date()),
    [props?.date]
  );
  const accessors = props?.accessors;
  const events: CalendarEvent[] = React.useMemo(
    () => (props?.events ?? []) as CalendarEvent[],
    [props?.events]
  );
  const onSelectEvent = props?.onSelectEvent as ((event: CalendarEvent, e?: unknown) => void) | undefined;

  const dayStart = React.useMemo(() => startOfDay(date), [date]);
  const dayEnd = React.useMemo(() => addDays(dayStart, 1), [dayStart]);

  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const items: DayEventItem[] = React.useMemo(() => {
    const resolved = events
      .map((event) => {
        const start: Date = accessors?.start ? accessors.start(event) : event.start;
        const end: Date = accessors?.end ? accessors.end(event) : event.end;
        const startDate = start ? new Date(start) : null;
        const endDate = end ? new Date(end) : null;
        if (!startDate || !endDate) return null;

        // Only include events that intersect this day; clamp to day bounds.
        if (endDate <= dayStart || startDate >= dayEnd) return null;
        const clampedStart = startDate < dayStart ? dayStart : startDate;
        const clampedEnd = endDate > dayEnd ? dayEnd : endDate;

        return { event, start: clampedStart, end: clampedEnd };
      })
      .filter(Boolean) as Array<{ event: CalendarEvent; start: Date; end: Date }>;

    resolved.sort((a, b) => {
      const byStart = a.start.getTime() - b.start.getTime();
      if (byStart !== 0) return byStart;
      return b.end.getTime() - a.end.getTime();
    });

    // Greedy lane assignment (interval graph coloring) so overlaps never overlap visually.
    const laneEndTimes: number[] = [];
    const placed: DayEventItem[] = [];

    for (const item of resolved) {
      let lane = -1;
      for (let i = 0; i < laneEndTimes.length; i += 1) {
        if (item.start.getTime() >= laneEndTimes[i]) {
          lane = i;
          break;
        }
      }

      if (lane === -1) {
        lane = laneEndTimes.length;
        laneEndTimes.push(item.end.getTime());
      } else {
        laneEndTimes[lane] = item.end.getTime();
      }

      placed.push({ ...item, lane });
    }

    return placed;
  }, [accessors, dayEnd, dayStart, events]);

  const laneCount = React.useMemo(() => {
    if (!items.length) return 1;
    return Math.max(...items.map((i) => i.lane)) + 1;
  }, [items]);

  const timelineWidth = MINUTES_PER_DAY * PX_PER_MINUTE;

  const nowLineLeft = React.useMemo(() => {
    if (!now) return null;
    if (now < dayStart || now >= dayEnd) return null;
    const minutes = differenceInMinutes(now, dayStart);
    return minutes * PX_PER_MINUTE;
  }, [dayEnd, dayStart, now]);

  const eventsByLane = React.useMemo(() => {
    const grouped: Record<number, DayEventItem[]> = {};
    for (const item of items) {
      grouped[item.lane] ??= [];
      grouped[item.lane].push(item);
    }
    return grouped;
  }, [items]);

  const hourMarks = React.useMemo(() => Array.from({ length: 25 }, (_, i) => i), []);

  return (
    <div className="h-full rounded-md border bg-background overflow-hidden">
      <div className="h-full overflow-auto">
        <div className="sticky top-0 z-30 isolate border-b bg-background shadow-sm">
          <div className="relative h-10" style={{ width: timelineWidth }}>
            {hourMarks.map((hour) => (
              <div
                key={hour}
                className="absolute top-0 bottom-0"
                style={{ left: hour * 60 * PX_PER_MINUTE }}
              >
                <div className="absolute top-0 bottom-0 w-px bg-border/70" />
                {hour < 24 && (
                  <div className="absolute left-1 top-2 text-[11px] font-medium text-muted-foreground">
                    {format(new Date(dayStart.getTime() + hour * 60 * 60 * 1000), "h a")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="relative" style={{ width: timelineWidth, minHeight: laneCount * EVENT_ROW_HEIGHT }}>
          {/* Grid lines */}
          <div className="pointer-events-none absolute inset-0 z-0">
            {hourMarks.map((hour) => (
              <div
                key={hour}
                className="absolute top-0 bottom-0 w-px bg-border/40"
                style={{ left: hour * 60 * PX_PER_MINUTE }}
              />
            ))}
            {Array.from({ length: 48 }, (_, idx) => idx).map((halfHour) => (
              <div
                key={halfHour}
                className="absolute top-0 bottom-0 w-px bg-border/20"
                style={{ left: halfHour * 30 * PX_PER_MINUTE }}
              />
            ))}
          </div>

          {/* Current time line */}
          {nowLineLeft !== null && (
            <div className="pointer-events-none absolute top-0 bottom-0 z-10" style={{ left: nowLineLeft }}>
              <div className="h-full w-[2px] bg-destructive/80" />
            </div>
          )}

          {/* Lanes */}
          <div className="relative z-10">
            {Array.from({ length: laneCount }, (_, lane) => (
              <div
                key={lane}
                className={cn(
                  "relative border-b last:border-b-0",
                  lane % 2 === 0 ? "bg-muted/10" : "bg-transparent"
                )}
                style={{ height: EVENT_ROW_HEIGHT }}
              >
                {(eventsByLane[lane] ?? []).map((item) => {
                  const startMin = Math.max(0, differenceInMinutes(item.start, dayStart));
                  const endMin = Math.min(MINUTES_PER_DAY, differenceInMinutes(item.end, dayStart));
                  const left = startMin * PX_PER_MINUTE;
                  const width = Math.max(8, (endMin - startMin) * PX_PER_MINUTE);
                  const bg = CATEGORY_COLORS[item.event.resource.category] ?? CATEGORY_COLORS.other;

                  return (
                    <div
                      key={item.event.id}
                      className="absolute rounded-md px-2 py-1 text-white shadow-sm overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                      style={{
                        left,
                        top: EVENT_PADDING_Y,
                        height: EVENT_ROW_HEIGHT - EVENT_PADDING_Y * 2,
                        width,
                        backgroundColor: bg,
                      }}
                      title={`${item.event.title}\n${format(item.start, "h:mm a")} - ${format(item.end, "h:mm a")}${item.event.resource.locationText ? `\n${item.event.resource.locationText}` : ""}`}
                      role={onSelectEvent ? "button" : undefined}
                      tabIndex={onSelectEvent ? 0 : undefined}
                      onClick={(e) => {
                        if (!onSelectEvent) return;
                        onSelectEvent(item.event, e);
                      }}
                      onKeyDown={(e) => {
                        if (!onSelectEvent) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectEvent(item.event, e);
                        }
                      }}
                    >
                      <div className="text-xs font-semibold leading-tight truncate">
                        {item.event.title}
                      </div>
                      <div className="text-[11px] opacity-90 leading-tight truncate">
                        {format(item.start, "h:mm a")} - {format(item.end, "h:mm a")}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

HorizontalDayView.navigate = (date: Date, action: "PREV" | "NEXT" | "TODAY") => {
  switch (action) {
    case "PREV":
      return addDays(date, -1);
    case "NEXT":
      return addDays(date, 1);
    case "TODAY":
      return new Date();
    default:
      return date;
  }
};

HorizontalDayView.range = (date: Date) => {
  const start = startOfDay(date);
  return [start];
};

HorizontalDayView.title = (date: Date) => format(date, "EEEE, MMM d, yyyy");

const CustomToolbar = (toolbar: any) => {
  const goToBack = () => {
    toolbar.onNavigate("PREV");
  };

  const goToNext = () => {
    toolbar.onNavigate("NEXT");
  };

  const goToCurrent = () => {
    toolbar.onNavigate("TODAY");
  };

  const label = () => {
    return (
      <span className="text-lg font-semibold">
        {toolbar.label}
      </span>
    );
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={goToBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={goToCurrent}>
          Today
        </Button>
        <Button variant="outline" size="icon" onClick={goToNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="ml-2">{label()}</div>
      </div>
      
      <div className="flex items-center gap-2">
        <Select 
          value={toolbar.view} 
          onValueChange={(v) => toolbar.onView(v)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="agenda">Agenda</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export function EventCalendar({ events, className }: EventCalendarProps) {
  const [view, setView] = React.useState<View>(Views.DAY);
  const [date, setDate] = React.useState(new Date());
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [selectedEvent, setSelectedEvent] = React.useState<Event | null>(null);
  const [groupOpen, setGroupOpen] = React.useState(false);
  const [selectedGroup, setSelectedGroup] = React.useState<GroupedEventResource | null>(null);

  const calendarEvents: CalendarEvent[] = React.useMemo(() => {
    return events.map((e) => ({
      id: e.id,
      title: e.title,
      start: new Date(e.startTime),
      end: new Date(e.endTime),
      resource: e,
    }));
  }, [events]);

  const calendarEventsForView: CalendarEvent[] = React.useMemo(() => {
    if (view !== Views.WEEK) return calendarEvents;

    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of calendarEvents) {
      if (isGroupedEventResource(event.resource)) continue;
      const dayKey = format(event.start, "yyyy-MM-dd");
      const key = `${dayKey}|${event.start.getTime()}|${event.end.getTime()}`;
      const bucket = grouped.get(key);
      if (bucket) bucket.push(event);
      else grouped.set(key, [event]);
    }

    const merged: CalendarEvent[] = [];
    for (const [key, bucket] of grouped.entries()) {
      if (bucket.length === 1) {
        merged.push(bucket[0]);
        continue;
      }

      const first = bucket[0];
      const bucketEvents = bucket
        .map((e) => e.resource)
        .filter((r): r is Event => !isGroupedEventResource(r));

      const categories = new Set(bucketEvents.map((e) => e.category));
      const category = categories.size === 1 ? bucketEvents[0].category : "other";

      const sameLocationId = bucketEvents.every((e) => e.locationId === bucketEvents[0].locationId);
      const sameLocationText = bucketEvents.every((e) => e.locationText === bucketEvents[0].locationText);

      merged.push({
        id: `group:${key}`,
        title: `${bucketEvents.length} events`,
        start: first.start,
        end: first.end,
        resource: {
          kind: "group",
          events: bucketEvents,
          category,
          locationId: sameLocationId ? bucketEvents[0].locationId : null,
          locationText: sameLocationText ? bucketEvents[0].locationText : null,
        },
      });
    }

    merged.sort((a, b) => a.start.getTime() - b.start.getTime());
    return merged;
  }, [calendarEvents, view]);

  const eventStyleGetter = (event: CalendarEvent) => {
    const category = event.resource.category;
    const backgroundColor = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;

    if (view === Views.AGENDA) {
      return {
        style: {
          backgroundColor: "transparent",
          color: "inherit",
        },
      };
    }

    return {
      style: {
        backgroundColor,
        borderRadius: "4px",
        opacity: 0.9,
        color: "white",
        border: "none",
        display: "block",
      }
    };
  };

  const handleSelectEvent = React.useCallback((event: unknown) => {
    const calendarEvent = event as CalendarEvent | null;
    if (!calendarEvent?.resource) return;
    if (isGroupedEventResource(calendarEvent.resource)) {
      setSelectedGroup(calendarEvent.resource);
      setGroupOpen(true);
      return;
    }
    setSelectedEvent(calendarEvent.resource);
    setDetailsOpen(true);
  }, []);

  return (
    <>
      <div className={cn("h-[600px] bg-background border rounded-lg p-4 shadow-sm", className)}>
        <Calendar
          localizer={localizer}
          events={calendarEventsForView}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%" }}
          views={{
            month: true,
            week: true,
            day: HorizontalDayView,
            agenda: true,
          }}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={handleSelectEvent}
          components={{
            toolbar: CustomToolbar,
            agenda: {
              event: AgendaEventCell,
            },
          }}
        />
      </div>

      <GroupedEventsDialog
        open={groupOpen}
        onOpenChange={(nextOpen) => {
          setGroupOpen(nextOpen);
          if (!nextOpen) setSelectedGroup(null);
        }}
        group={selectedGroup}
        onSelect={(picked) => {
          setGroupOpen(false);
          setSelectedGroup(null);
          setSelectedEvent(picked);
          setDetailsOpen(true);
        }}
      />

      <EventDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} event={selectedEvent} />
    </>
  );
}
