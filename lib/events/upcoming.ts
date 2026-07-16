import type { Event } from "../types/events";

export function isUpcomingEvent(event: Pick<Event, "endTime">, now: Date = new Date()): boolean {
  const endMs = Date.parse(event.endTime);
  if (Number.isNaN(endMs)) return true;
  return endMs >= now.getTime();
}

export function getUpcomingEvents(events: readonly Event[], now: Date = new Date()): Event[] {
  return events.filter((event) => isUpcomingEvent(event, now));
}
