import type { PathResult, TransportMode } from "@/lib/types/graph";

type Point = { lat: number; lng: number };

// Optional keyed providers (both fully free, no credit card, OSM-based, foot
// profile, browser-CORS). Precedence: Geoapify -> OpenRouteService -> keyless
// OSRM-DE. Set whichever key you prefer.
//   - Geoapify: key is restrictable to your domain (safest for a NEXT_PUBLIC
//     key), production allowed, 3000/day, 5 req/s.
//   - OpenRouteService (HeiGIT): 2000/day, 40/min, cleanest self-host path; key
//     cannot be domain-locked, so prefer it for non-commercial / lower traffic.
const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;
const ORS_KEY = process.env.NEXT_PUBLIC_ORS_KEY;

/** Per-provider client-side request budget for the routing scheduler. */
export const ROUTING_BUDGET = GEOAPIFY_KEY
  ? { minIntervalMs: 220, concurrency: 4 } // Geoapify ~5 req/s
  : ORS_KEY
    ? { minIntervalMs: 1600, concurrency: 1 } // ORS 40/min
    : { minIntervalMs: 1100, concurrency: 1 }; // keyless OSRM-DE demo ~1 req/s

const REQUEST_TIMEOUT_MS = 8000;

// fetch() that aborts on a timeout or when the caller's signal aborts (combining
// both without relying on AbortSignal.any for older runtimes).
async function fetchWithTimeout(url: string, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Keyless OSRM foot/car router hosted by OpenStreetMap-DE. CORS-enabled and
 * returns realistic on-foot durations. It is a community demo service (≈1 req/s,
 * no SLA, non-commercial) used as the default + fallback. The response is the
 * standard OSRM shape, which this module already parses.
 */
export function buildExternalRoutingUrl(
  start: Point,
  end: Point,
  mode: TransportMode,
) {
  const profile = mode === "driving" ? "car" : "foot";
  const params = new URLSearchParams({
    alternatives: "false",
    geometries: "geojson",
    overview: "full",
    steps: "false",
  });

  return `https://routing.openstreetmap.de/routed-${profile}/route/v1/${profile}/${start.lng},${start.lat};${end.lng},${end.lat}?${params.toString()}`;
}

export function buildGeoapifyRoutingUrl(
  start: Point,
  end: Point,
  mode: TransportMode,
  apiKey: string,
) {
  const params = new URLSearchParams({
    waypoints: `${start.lat},${start.lng}|${end.lat},${end.lng}`,
    mode: mode === "driving" ? "drive" : "walk",
    apiKey,
  });

  return `https://api.geoapify.com/v1/routing?${params.toString()}`;
}

export function buildOrsRoutingUrl(
  start: Point,
  end: Point,
  mode: TransportMode,
  apiKey: string,
) {
  const profile = mode === "driving" ? "driving-car" : "foot-walking";
  const params = new URLSearchParams({
    api_key: apiKey,
    start: `${start.lng},${start.lat}`,
    end: `${end.lng},${end.lat}`,
  });

  return `https://api.openrouteservice.org/v2/directions/${profile}?${params.toString()}`;
}

// Graph fallback speeds (m/min) — only used if the provider omits a duration.
const FALLBACK_SPEEDS: Record<TransportMode, number> = { walking: 80, driving: 500 };

function toMinutes(
  seconds: number | undefined,
  distanceMeters: number,
  mode: TransportMode,
): number {
  if (typeof seconds === "number" && Number.isFinite(seconds)) {
    return Math.max(1, Math.round(seconds / 60));
  }
  return Math.max(1, Math.ceil(distanceMeters / FALLBACK_SPEEDS[mode]));
}

async function fetchOsrm(
  start: Point,
  end: Point,
  mode: TransportMode,
  signal?: AbortSignal,
): Promise<PathResult | null> {
  const response = await fetchWithTimeout(buildExternalRoutingUrl(start, end, mode), signal);
  if (!response.ok) return null;

  const data = await response.json();
  const route = data?.routes?.[0];
  if (!route?.geometry || route.geometry.type !== "LineString") return null;

  const path = route.geometry.coordinates.map(
    (coords: [number, number], index: number) => ({
      id: `ext-${index}`,
      lat: coords[1],
      lng: coords[0],
      type: "node" as const,
    }),
  );

  return {
    path,
    totalDistance: route.distance,
    estimatedTime: toMinutes(route.duration, route.distance, mode),
  };
}

async function fetchGeoapify(
  start: Point,
  end: Point,
  mode: TransportMode,
  apiKey: string,
  signal?: AbortSignal,
): Promise<PathResult | null> {
  const response = await fetchWithTimeout(
    buildGeoapifyRoutingUrl(start, end, mode, apiKey),
    signal,
  );
  if (!response.ok) return null;

  const data = await response.json();
  const feature = data?.features?.[0];
  const geometry = feature?.geometry;
  if (!geometry) return null;

  // Geoapify returns LineString or MultiLineString; coordinates are [lng, lat].
  const rings: Array<Array<[number, number]>> =
    geometry.type === "MultiLineString" ? geometry.coordinates : [geometry.coordinates];
  const path = rings.flat().map((coords, index) => ({
    id: `ext-${index}`,
    lat: coords[1],
    lng: coords[0],
    type: "node" as const,
  }));
  if (path.length === 0) return null;

  const distance =
    typeof feature.properties?.distance === "number" ? feature.properties.distance : 0;

  return {
    path,
    totalDistance: distance,
    estimatedTime: toMinutes(feature.properties?.time, distance, mode),
  };
}

async function fetchOrs(
  start: Point,
  end: Point,
  mode: TransportMode,
  apiKey: string,
  signal?: AbortSignal,
): Promise<PathResult | null> {
  const response = await fetchWithTimeout(
    buildOrsRoutingUrl(start, end, mode, apiKey),
    signal,
  );
  if (!response.ok) return null;

  const data = await response.json();
  const feature = data?.features?.[0];
  const geometry = feature?.geometry;
  if (!geometry || geometry.type !== "LineString") return null;

  const path = geometry.coordinates.map((coords: [number, number], index: number) => ({
    id: `ext-${index}`,
    lat: coords[1],
    lng: coords[0],
    type: "node" as const,
  }));
  if (path.length === 0) return null;

  const summary = feature.properties?.summary ?? {};
  const distance = typeof summary.distance === "number" ? summary.distance : 0;

  return {
    path,
    totalDistance: distance,
    estimatedTime: toMinutes(summary.duration, distance, mode),
  };
}

export async function getExternalPath(
  start: Point,
  end: Point,
  mode: TransportMode = "walking",
  signal?: AbortSignal,
): Promise<PathResult | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;

  // Try keyed providers first; any keyed-provider failure (error or empty) must
  // still fall through to the next option rather than abandoning the route.
  if (GEOAPIFY_KEY) {
    try {
      const route = await fetchGeoapify(start, end, mode, GEOAPIFY_KEY, signal);
      if (route) return route;
    } catch (error) {
      if (signal?.aborted) return null;
      console.error("Geoapify routing failed, falling back:", error);
    }
  }

  if (ORS_KEY) {
    try {
      const route = await fetchOrs(start, end, mode, ORS_KEY, signal);
      if (route) return route;
    } catch (error) {
      if (signal?.aborted) return null;
      console.error("OpenRouteService routing failed, falling back to OSRM:", error);
    }
  }

  try {
    return await fetchOsrm(start, end, mode, signal);
  } catch (error) {
    if (!signal?.aborted) console.error("External routing failed:", error);
    return null;
  }
}
