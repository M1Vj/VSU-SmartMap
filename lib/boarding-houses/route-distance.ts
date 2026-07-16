// Real walking-route distance/time for the public boarding-houses search.
// Uses the same live router as map navigation (lib/pathfinding/external: Geoapify
// when keyed, else keyless OSRM-DE foot routing). Falls back to a straight-line
// haversine estimate when offline or the provider is unavailable, so the UI
// always has a number.
//
// Hardened for low-bandwidth use: requests go through a shared rate limiter
// (so a list of listings cannot burst past the provider's budget), identical
// in-flight requests are de-duplicated, results are memoised, and recent
// failures are negatively cached briefly to avoid re-bursting.

import { getExternalPath, ROUTING_BUDGET } from "@/lib/pathfinding/external";
import { approxWalkMinutes, haversineMeters, type LatLngPoint } from "./distance";

export type WalkEstimate = {
  /** Approximate walking minutes. */
  minutes: number;
  /** Route (or straight-line) distance in metres. */
  meters: number;
  /** True when this is a straight-line fallback, not a real route. */
  approximate: boolean;
};

const CACHE_LIMIT = 500;
const NEGATIVE_TTL_MS = 30_000;

// Provider budget (set in lib/pathfinding/external by which key is configured):
// keyless OSRM-DE ~1 req/s, ORS 40/min, Geoapify ~5 req/s. Stay under each.
const MIN_INTERVAL_MS = ROUTING_BUDGET.minIntervalMs;
const MAX_CONCURRENCY = ROUTING_BUDGET.concurrency;

const cache = new Map<string, WalkEstimate>(); // real routes only
const inflight = new Map<string, Promise<WalkEstimate>>();
const failedUntil = new Map<string, number>(); // key -> timestamp to retry after

function cacheKey(from: LatLngPoint, to: LatLngPoint): string {
  // ~1 m precision keeps tiny pin nudges on the same cache entry.
  return `${from.lat.toFixed(5)},${from.lng.toFixed(5)}->${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
}

function rememberRoute(key: string, estimate: WalkEstimate): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value; // Map preserves insertion order (FIFO)
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, estimate);
}

// --- Shared leaky-bucket scheduler: <= MAX_CONCURRENCY in flight, dispatches
// spaced by >= MIN_INTERVAL_MS so a listing sweep never bursts the provider. ---
type Job = { task: () => Promise<unknown>; resolve: (v: unknown) => void; reject: (e: unknown) => void };
const jobQueue: Job[] = [];
let activeCount = 0;
let lastDispatch = 0;

function pump(): void {
  if (jobQueue.length === 0 || activeCount >= MAX_CONCURRENCY) return;
  const wait = lastDispatch + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) {
    setTimeout(pump, wait);
    return;
  }
  const job = jobQueue.shift()!;
  activeCount += 1;
  lastDispatch = Date.now();
  Promise.resolve()
    .then(job.task)
    .then(job.resolve, job.reject)
    .finally(() => {
      activeCount -= 1;
      pump();
    });
  if (jobQueue.length > 0) setTimeout(pump, MIN_INTERVAL_MS);
}

function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    jobQueue.push({ task: task as () => Promise<unknown>, resolve: resolve as (v: unknown) => void, reject });
    pump();
  });
}

export function straightLineEstimate(from: LatLngPoint, to: LatLngPoint): WalkEstimate {
  const meters = haversineMeters(from, to);
  return { meters, minutes: approxWalkMinutes(meters), approximate: true };
}

/**
 * Walking estimate from `from` to `to`. Tries the live router first (cached,
 * de-duplicated, rate-limited), then degrades to a labelled straight-line
 * estimate. Pass an AbortSignal to cancel a superseded request. Never throws.
 */
export async function getWalkEstimate(
  from: LatLngPoint,
  to: LatLngPoint,
  signal?: AbortSignal,
): Promise<WalkEstimate> {
  const key = cacheKey(from, to);

  const cached = cache.get(key);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  // Recently failed: serve a straight-line estimate without re-hitting the
  // network until the cooldown passes (prevents a 429 storm from re-bursting).
  const retryAfter = failedUntil.get(key);
  if (retryAfter && Date.now() < retryAfter) return straightLineEstimate(from, to);

  const promise = (async (): Promise<WalkEstimate> => {
    let estimate: WalkEstimate;
    try {
      const route = await schedule(() => getExternalPath(from, to, "walking", signal));
      estimate =
        route && route.estimatedTime != null
          ? { minutes: route.estimatedTime, meters: route.totalDistance, approximate: false }
          : straightLineEstimate(from, to);
    } catch {
      estimate = straightLineEstimate(from, to);
    }

    if (!estimate.approximate) {
      rememberRoute(key, estimate);
      failedUntil.delete(key);
    } else if (!signal?.aborted) {
      // A real failure (not a cancellation) — back off briefly.
      failedUntil.set(key, Date.now() + NEGATIVE_TTL_MS);
    }
    inflight.delete(key);
    return estimate;
  })();

  inflight.set(key, promise);
  return promise;
}
