export const MAP_PERFORMANCE_METRICS = [
  "marker_first_interaction",
  "route_calculation",
  "route_zoom_continuity",
] as const;

export type MapPerformanceMetric = (typeof MAP_PERFORMANCE_METRICS)[number];

type MetricSample = {
  count: number;
  last: number | null;
};

export type MapPerformanceSnapshot = Record<MapPerformanceMetric, MetricSample>;

const MAX_SAMPLES_PER_METRIC = 32;

const pendingStarts: Record<MapPerformanceMetric, number | null> = Object.fromEntries(
  MAP_PERFORMANCE_METRICS.map((metric) => [metric, null]),
) as Record<MapPerformanceMetric, number | null>;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

const samples: MapPerformanceSnapshot = Object.fromEntries(
  MAP_PERFORMANCE_METRICS.map((metric) => [metric, { count: 0, last: null }]),
) as MapPerformanceSnapshot;

export function recordMapPerformance(metric: MapPerformanceMetric, value: number): void {
  if (!Number.isFinite(value) || value < 0) return;

  const sample = samples[metric];
  if (sample.count >= MAX_SAMPLES_PER_METRIC) {
    // Keep the bounded count while retaining the latest diagnostic value.
    sample.last = value;
    return;
  }

  sample.count += 1;
  sample.last = value;
}

export function startMapPerformance(metric: MapPerformanceMetric, startedAt = now()): void {
  if (!Number.isFinite(startedAt) || startedAt < 0) return;
  pendingStarts[metric] = startedAt;
}

export function completeMapPerformance(metric: MapPerformanceMetric, completedAt = now()): void {
  const startedAt = pendingStarts[metric];
  pendingStarts[metric] = null;
  if (startedAt === null || !Number.isFinite(completedAt)) return;
  recordMapPerformance(metric, Math.max(0, completedAt - startedAt));
}

export function cancelMapPerformance(metric: MapPerformanceMetric): void {
  pendingStarts[metric] = null;
}

export function getMapPerformanceSnapshot(): MapPerformanceSnapshot {
  return Object.fromEntries(
    MAP_PERFORMANCE_METRICS.map((metric) => [metric, { ...samples[metric] }]),
  ) as MapPerformanceSnapshot;
}

export function resetMapPerformance(): void {
  for (const metric of MAP_PERFORMANCE_METRICS) {
    samples[metric].count = 0;
    samples[metric].last = null;
    pendingStarts[metric] = null;
  }
}
