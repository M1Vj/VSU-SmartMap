import test from "node:test";
import assert from "node:assert/strict";

import { getUpcomingEvents } from "./upcoming.ts";
import type { Event } from "../types/events.ts";

const makeEvent = (overrides: Partial<Event>): Event => ({
  id: overrides.id ?? "event-1",
  title: overrides.title ?? "Sample Event",
  description: overrides.description ?? null,
  startTime: overrides.startTime ?? "2026-03-12T09:00:00.000Z",
  endTime: overrides.endTime ?? "2026-03-12T10:00:00.000Z",
  locationText: overrides.locationText ?? null,
  locationId: overrides.locationId ?? null,
  category: overrides.category ?? "academic",
  imageUrl: overrides.imageUrl ?? null,
  createdAt: overrides.createdAt ?? "2026-03-01T00:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-03-01T00:00:00.000Z",
});

test("getUpcomingEvents excludes events that already ended", () => {
  const now = new Date("2026-03-12T10:00:00.000Z");
  const events: Event[] = [
    makeEvent({
      id: "past",
      endTime: "2026-03-12T09:59:59.000Z",
    }),
    makeEvent({
      id: "upcoming",
      endTime: "2026-03-12T10:30:00.000Z",
    }),
  ];

  const upcoming = getUpcomingEvents(events, now);

  assert.deepEqual(upcoming.map((event) => event.id), ["upcoming"]);
});

test("getUpcomingEvents keeps events that end exactly at the current time", () => {
  const now = new Date("2026-03-12T10:00:00.000Z");
  const events: Event[] = [
    makeEvent({
      id: "boundary",
      endTime: "2026-03-12T10:00:00.000Z",
    }),
  ];

  const upcoming = getUpcomingEvents(events, now);

  assert.equal(upcoming.length, 1);
  assert.equal(upcoming[0]?.id, "boundary");
});

test("getUpcomingEvents keeps only upcoming ids in order", () => {
  const now = new Date("2026-03-12T10:00:00.000Z");
  const events: Event[] = [
    makeEvent({
      id: "first-upcoming",
      endTime: "2026-03-12T11:00:00.000Z",
    }),
    makeEvent({
      id: "past",
      endTime: "2026-03-12T08:00:00.000Z",
    }),
    makeEvent({
      id: "second-upcoming",
      endTime: "2026-03-12T12:30:00.000Z",
    }),
  ];

  const upcoming = getUpcomingEvents(events, now);

  assert.deepEqual(
    upcoming.map((event) => event.id),
    ["first-upcoming", "second-upcoming"]
  );
});
