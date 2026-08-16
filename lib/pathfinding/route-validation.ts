import type { MapNode, PathResult } from "@/lib/types/graph";
import { getDistance } from "./astar";

export interface RouteEndpoint {
  lat: number;
  lng: number;
}

/**
 * External routers may snap waypoints to a nearby routable road. The map's
 * own facility-entry matching uses a 50m radius, so allow at most two such
 * radii at each endpoint while rejecting the multi-hundred-metre gate jumps
 * observed in live OSRM responses.
 */
export const ROUTE_ENDPOINT_SNAP_TOLERANCE_METERS = 100;

const MIN_ROUTE_SPAN_METERS = 1;
const ENDPOINT_ASSIGNMENT_EPSILON_METERS = 1e-6;

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

export function isValidPathResultForEndpoints(
  value: unknown,
  expectedStart: RouteEndpoint,
  expectedEnd: RouteEndpoint,
  toleranceMeters = ROUTE_ENDPOINT_SNAP_TOLERANCE_METERS,
): value is PathResult {
  if (
    !isValidPathResult(value) ||
    !isFiniteCoordinate(expectedStart.lat, -90, 90) ||
    !isFiniteCoordinate(expectedStart.lng, -180, 180) ||
    !isFiniteCoordinate(expectedEnd.lat, -90, 90) ||
    !isFiniteCoordinate(expectedEnd.lng, -180, 180) ||
    !Number.isFinite(toleranceMeters) ||
    toleranceMeters < 0
  ) {
    return false;
  }

  if (
    getDistance(expectedStart.lat, expectedStart.lng, expectedEnd.lat, expectedEnd.lng) <
    MIN_ROUTE_SPAN_METERS
  ) {
    return false;
  }

  const first = value.path[0];
  const last = value.path[value.path.length - 1];
  const firstToStart = getDistance(first.lat, first.lng, expectedStart.lat, expectedStart.lng);
  const lastToEnd = getDistance(last.lat, last.lng, expectedEnd.lat, expectedEnd.lng);
  if (firstToStart > toleranceMeters || lastToEnd > toleranceMeters) {
    return false;
  }

  const forwardAssignment = firstToStart + lastToEnd;
  const reverseAssignment =
    getDistance(first.lat, first.lng, expectedEnd.lat, expectedEnd.lng) +
    getDistance(last.lat, last.lng, expectedStart.lat, expectedStart.lng);
  if (forwardAssignment + ENDPOINT_ASSIGNMENT_EPSILON_METERS >= reverseAssignment) {
    return false;
  }

  for (let index = 1; index < value.path.length; index += 1) {
    const previous = value.path[index - 1];
    const current = value.path[index];
    if (getDistance(previous.lat, previous.lng, current.lat, current.lng) >= MIN_ROUTE_SPAN_METERS) {
      return true;
    }
  }

  return false;
}

/**
 * Return a validated provider route whose endpoints are owned by this request.
 * Providers can legally snap within the bounded tolerance, but the merged
 * route must begin and end at the exact requested points/gate coordinates.
 */
export function normalizePathResultEndpoints(
  value: unknown,
  expectedStart: RouteEndpoint,
  expectedEnd: RouteEndpoint,
  toleranceMeters = ROUTE_ENDPOINT_SNAP_TOLERANCE_METERS,
): PathResult | null {
  if (!isValidPathResultForEndpoints(value, expectedStart, expectedEnd, toleranceMeters)) {
    return null;
  }

  const path = value.path.map((node, index) => {
    if (index === 0) {
      return { ...node, lat: expectedStart.lat, lng: expectedStart.lng };
    }
    if (index === value.path.length - 1) {
      return { ...node, lat: expectedEnd.lat, lng: expectedEnd.lng };
    }
    return node;
  });

  const normalized = { ...value, path };
  for (let index = 1; index < path.length; index += 1) {
    if (getDistance(path[index - 1].lat, path[index - 1].lng, path[index].lat, path[index].lng) >= MIN_ROUTE_SPAN_METERS) {
      return normalized;
    }
  }

  return null;
}
