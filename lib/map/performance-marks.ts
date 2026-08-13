export type MapPerformanceEvent = "map-ready" | "marker-activation" | "route-request" | "route-commit" | "route-refresh";

const EVENT_LIMIT = 64;
const events: Array<{ name: MapPerformanceEvent; durationMs: number }> = [];

export function markMapPerformance(name: MapPerformanceEvent, startedAt: number, endedAt?: number): void {
  if (typeof performance === "undefined") return;
  const durationMs = Math.max(0, Math.round(((endedAt ?? performance.now()) - startedAt) * 100) / 100);
  events.push({ name, durationMs });
  if (events.length > EVENT_LIMIT) events.shift();
}

export function getMapPerformanceEvents(): readonly { name: MapPerformanceEvent; durationMs: number }[] {
  return events;
}

export function clearMapPerformanceEvents(): void {
  events.length = 0;
}
