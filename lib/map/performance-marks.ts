export type MapPerformanceEvent = "map-ready" | "marker-activation" | "route-request" | "route-commit" | "route-refresh" | "route-failure";

const EVENT_LIMIT = 64;
type PerformanceEvent = { name: MapPerformanceEvent; durationMs: number; requestId?: number };
const events: PerformanceEvent[] = [];
const routeRequests = new Map<number, number>();

function now(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export function markMapPerformance(name: MapPerformanceEvent, startedAt: number, endedAt?: number, requestId?: number): void {
  if (typeof performance === "undefined") return;
  const durationMs = Math.max(0, Math.round(((endedAt ?? performance.now()) - startedAt) * 100) / 100);
  events.push({ name, durationMs, ...(requestId === undefined ? {} : { requestId }) });
  if (events.length > EVENT_LIMIT) events.shift();
}

export function beginMapPerformanceRequest(requestId: number, startedAt = now()): void {
  // The runtime accepts only the latest request. Retire any older start mark
  // so a stale completion cannot publish a duration after replacement/clear.
  for (const previousRequestId of routeRequests.keys()) {
    if (previousRequestId !== requestId) routeRequests.delete(previousRequestId);
  }
  routeRequests.set(requestId, startedAt);
}

function finishMapPerformanceRequest(name: "route-commit" | "route-failure", requestId: number, endedAt = now()): void {
  const startedAt = routeRequests.get(requestId);
  if (startedAt === undefined) return;
  routeRequests.delete(requestId);
  markMapPerformance(name, startedAt, endedAt, requestId);
}

export function commitMapPerformanceRequest(requestId: number, endedAt = now()): void {
  finishMapPerformanceRequest("route-commit", requestId, endedAt);
}

export function failMapPerformanceRequest(requestId: number, endedAt = now()): void {
  finishMapPerformanceRequest("route-failure", requestId, endedAt);
}

export function clearMapPerformanceRequest(requestId: number): void {
  routeRequests.delete(requestId);
}

export function getMapPerformanceEvents(): readonly PerformanceEvent[] {
  return events;
}

export function clearMapPerformanceEvents(): void {
  events.length = 0;
  routeRequests.clear();
}
