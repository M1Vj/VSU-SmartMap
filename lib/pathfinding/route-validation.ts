import type { MapNode, PathResult } from "@/lib/types/graph";

function isFiniteCoordinate(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isValidRouteNode(value: unknown): value is MapNode {
  if (!value || typeof value !== "object") return false;

  const node = value as { lat?: unknown; lng?: unknown };
  return (
    isFiniteCoordinate(node.lat, -90, 90) &&
    isFiniteCoordinate(node.lng, -180, 180)
  );
}

/**
 * Accept only route results that can be rendered as a real segment.
 * Provider responses are untrusted at runtime even though their parsed shape
 * is typed as `PathResult`.
 */
export function isValidPathResult(value: unknown): value is PathResult {
  if (!value || typeof value !== "object") return false;

  const route = value as {
    path?: unknown;
    totalDistance?: unknown;
    estimatedTime?: unknown;
  };

  if (!Array.isArray(route.path) || route.path.length < 2) return false;
  for (let index = 0; index < route.path.length; index += 1) {
    if (
      !Object.prototype.hasOwnProperty.call(route.path, index) ||
      !isValidRouteNode(route.path[index])
    ) {
      return false;
    }
  }
  if (
    typeof route.totalDistance !== "number" ||
    !Number.isFinite(route.totalDistance) ||
    route.totalDistance < 0
  ) {
    return false;
  }
  if (
    route.estimatedTime !== undefined &&
    (typeof route.estimatedTime !== "number" ||
      !Number.isFinite(route.estimatedTime) ||
      route.estimatedTime < 0)
  ) {
    return false;
  }

  return true;
}
