import { calculateTime, getDistance } from "@/lib/pathfinding/astar";
import type { MapEdge, MapNode, PathResult, TransportMode } from "@/lib/types/graph";

type Point = { lat: number; lng: number };

export const ROUTING_BOUNDARY_GATES = [
  { id: "gate-west", lat: 10.744749262354008, lng: 124.78503904754665 },
  { id: "gate-north", lat: 10.751812878642097, lng: 124.79807438413424 },
  { id: "gate-east", lat: 10.743422208739132, lng: 124.80770893961328 },
  { id: "gate-south", lat: 10.739163728666414, lng: 124.78751707448582 },
] as const satisfies readonly (Point & { id: string })[];

export function isPointInsideRoutingBoundary(point: Point): boolean {
  let inside = false;

  for (let i = 0, j = ROUTING_BOUNDARY_GATES.length - 1; i < ROUTING_BOUNDARY_GATES.length; j = i++) {
    const current = ROUTING_BOUNDARY_GATES[i];
    const previous = ROUTING_BOUNDARY_GATES[j];
    if (isPointOnSegment(point, previous, current)) return true;

    const intersects =
      current.lng > point.lng !== previous.lng > point.lng &&
      point.lat <
        ((previous.lat - current.lat) * (point.lng - current.lng)) /
          (previous.lng - current.lng) +
          current.lat;

    if (intersects) inside = !inside;
  }

  return inside;
}

/**
 * Best external<->internal handoff point for a route between `point` and
 * `toward`. Prefers admin-defined "gate" nodes from the graph (set in the
 * navigation editor); falls back to the built-in boundary corners when none
 * exist. Picks the gate with the smallest total detour (point -> gate ->
 * toward) so an outside start near one entrance never gets funneled through a
 * gate on the far side of campus.
 */
export function findClosestTransitionGate(
  point: Point,
  toward: Point,
  graphNodes?: readonly MapNode[],
): MapNode {
  const gateNodes = graphNodes?.filter((node) => node.type === "gate") ?? [];
  const candidates: ReadonlyArray<Point & { id: string }> =
    gateNodes.length > 0 ? gateNodes : ROUTING_BOUNDARY_GATES;

  let closest = candidates[0];
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const gate of candidates) {
    const distance =
      getDistance(point.lat, point.lng, gate.lat, gate.lng) +
      getDistance(gate.lat, gate.lng, toward.lat, toward.lng);
    if (distance < closestDistance) {
      closest = gate;
      closestDistance = distance;
    }
  }

  return {
    id: closest.id,
    lat: closest.lat,
    lng: closest.lng,
    type: "node",
  };
}

export function filterGraphToRoutingBoundary(nodes: MapNode[], edges: MapEdge[]) {
  const nodesInside = nodes.filter((node) => isPointInsideRoutingBoundary(node));
  const nodeIds = new Set(nodesInside.map((node) => node.id));
  const edgesInside = edges.filter(
    (edge) => nodeIds.has(edge.source_id) && nodeIds.has(edge.target_id)
  );

  return { nodes: nodesInside, edges: edgesInside };
}

export function mergePathsAtTransitionGate(
  leadingPath: MapNode[],
  gate: MapNode,
  trailingPath: MapNode[],
  mode: TransportMode
): PathResult {
  const path = appendUniquePoints([], leadingPath);
  appendUniquePoint(path, gate);
  appendUniquePoints(path, trailingPath);

  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalDistance += getDistance(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
  }

  return {
    path,
    totalDistance,
    estimatedTime: calculateTime(totalDistance, mode),
  };
}

function appendUniquePoints(target: MapNode[], points: MapNode[]) {
  for (const point of points) appendUniquePoint(target, point);
  return target;
}

function appendUniquePoint(target: MapNode[], point: MapNode) {
  const last = target[target.length - 1];
  if (last && getDistance(last.lat, last.lng, point.lat, point.lng) < 1) return;
  target.push(point);
}

function isPointOnSegment(point: Point, a: Point, b: Point) {
  const cross =
    (point.lng - a.lng) * (b.lat - a.lat) -
    (point.lat - a.lat) * (b.lng - a.lng);

  if (Math.abs(cross) > 1e-10) return false;

  const withinLat =
    point.lat >= Math.min(a.lat, b.lat) - 1e-10 &&
    point.lat <= Math.max(a.lat, b.lat) + 1e-10;
  const withinLng =
    point.lng >= Math.min(a.lng, b.lng) - 1e-10 &&
    point.lng <= Math.max(a.lng, b.lng) + 1e-10;

  return withinLat && withinLng;
}
