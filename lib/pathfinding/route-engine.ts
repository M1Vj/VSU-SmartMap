import type { MapEdge, MapNode, PathResult, TransportMode } from "@/lib/types/graph";
import {
  calculateTime,
  getDistance,
  getNearestPointOnSegment,
  isEdgeClosed,
  isNodeClosed,
} from "./astar";

function stableSchedule(schedule: MapNode["closure_daily_schedule"] | MapEdge["closure_daily_schedule"]): string | null {
  if (!schedule) return null;
  return JSON.stringify(
    Object.keys(schedule)
      .sort((left, right) => Number(left) - Number(right))
      .map((day) => [day, schedule[Number(day)] ?? null]),
  );
}

export interface PreparedRouteGraph {
  revision: string;
  nodes: readonly MapNode[];
  edges: readonly MapEdge[];
  nodeById: ReadonlyMap<string, MapNode>;
  adjacency: ReadonlyMap<string, readonly MapEdge[]>;
  incomingAdjacency: ReadonlyMap<string, readonly MapEdge[]>;
  buildingEntries: readonly MapNode[];
  buildingEntriesById: ReadonlyMap<string, readonly MapNode[]>;
}

export function getRouteGraphRevision(
  nodes: readonly MapNode[],
  edges: readonly MapEdge[],
): string {
  const nodePart = nodes
    .map((node) => JSON.stringify({
      id: node.id,
      lat: node.lat,
      lng: node.lng,
      type: node.type,
      building_ids: [...(node.building_ids ?? [])].sort(),
      floor_level: node.floor_level ?? null,
      is_closed: node.is_closed ?? false,
      closed_until_toggled: node.closed_until_toggled ?? false,
      closed_from: node.closed_from ?? null,
      closed_until: node.closed_until ?? null,
      closure_reason: node.closure_reason ?? null,
      closure_recurring_start: node.closure_recurring_start ?? null,
      closure_recurring_end: node.closure_recurring_end ?? null,
      closure_recurring_days: [...(node.closure_recurring_days ?? [])].sort(),
      closure_daily_schedule: stableSchedule(node.closure_daily_schedule),
      group_id: node.group_id ?? null,
    }))
    .sort()
    .join("|");
  const edgePart = edges
    .map((edge) => JSON.stringify({
      id: edge.id,
      source_id: edge.source_id,
      target_id: edge.target_id,
      weight: edge.weight,
      bidirectional: edge.bidirectional,
      type: edge.type,
      access: [...(edge.access ?? [])].sort(),
      is_closed: edge.is_closed ?? false,
      closed_until_toggled: edge.closed_until_toggled ?? false,
      closed_from: edge.closed_from ?? null,
      closed_until: edge.closed_until ?? null,
      closure_reason: edge.closure_reason ?? null,
      closure_recurring_start: edge.closure_recurring_start ?? null,
      closure_recurring_end: edge.closure_recurring_end ?? null,
      closure_recurring_days: [...(edge.closure_recurring_days ?? [])].sort(),
      closure_daily_schedule: stableSchedule(edge.closure_daily_schedule),
    }))
    .sort()
    .join("|");
  const canonical = `${nodePart}#${edgePart}`;
  // Keep the revision bounded even when the graph contains thousands of
  // records. The canonical payload above ensures every routing-relevant field
  // participates before the deterministic FNV-1a fold.
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `graph-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function prepareRouteGraph(
  nodes: readonly MapNode[],
  edges: readonly MapEdge[],
  revision: string,
): PreparedRouteGraph {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, MapEdge[]>();
  const incomingAdjacency = new Map<string, MapEdge[]>();
  const buildingEntries: MapNode[] = [];
  const buildingEntriesById = new Map<string, MapNode[]>();
  for (const node of nodes) {
    if (node.type !== "building_entry") continue;
    buildingEntries.push(node);
    for (const buildingId of node.building_ids ?? []) {
      buildingEntriesById.get(buildingId)?.push(node) ?? buildingEntriesById.set(buildingId, [node]);
    }
  }
  for (const edge of edges) {
    adjacency.get(edge.source_id)?.push(edge) ?? adjacency.set(edge.source_id, [edge]);
    if (edge.bidirectional) {
      adjacency.get(edge.target_id)?.push(edge) ?? adjacency.set(edge.target_id, [edge]);
    }
    incomingAdjacency.get(edge.target_id)?.push(edge) ?? incomingAdjacency.set(edge.target_id, [edge]);
    if (edge.bidirectional) {
      incomingAdjacency.get(edge.source_id)?.push(edge) ?? incomingAdjacency.set(edge.source_id, [edge]);
    }
  }
  return { revision, nodes, edges, nodeById, adjacency, incomingAdjacency, buildingEntries, buildingEntriesById };
}

function canTraverse(edge: MapEdge, mode: TransportMode, nodeById: ReadonlyMap<string, MapNode>): boolean {
  if (isEdgeClosed(edge)) return false;
  const source = nodeById.get(edge.source_id);
  const target = nodeById.get(edge.target_id);
  if (!source || !target || isNodeClosed(source) || isNodeClosed(target)) return false;
  if (edge.access?.length) return edge.access.includes(mode);
  return edge.type === "road" ? true : mode === "walking";
}

export function isPreparedNodeNavigable(
  graph: PreparedRouteGraph,
  nodeId: string,
  mode: TransportMode,
  asSource = true,
): boolean {
  const node = graph.nodeById.get(nodeId);
  if (!node || isNodeClosed(node)) return false;
  const candidateEdges = asSource ? graph.adjacency.get(nodeId) : graph.incomingAdjacency.get(nodeId);
  return (candidateEdges ?? []).some((edge) => {
    if (!canTraverse(edge, mode, graph.nodeById)) return false;
    return asSource
      ? edge.source_id === nodeId || (edge.bidirectional && edge.target_id === nodeId)
      : edge.target_id === nodeId || (edge.bidirectional && edge.source_id === nodeId);
  });
}

export function findPreparedNearestEdge(
  graph: PreparedRouteGraph,
  lat: number,
  lng: number,
  mode: TransportMode,
): { nearestPoint: { lat: number; lng: number }; nearestEdge: MapEdge | null; distance: number } {
  let minDistance = Infinity;
  let nearestPoint = { lat, lng };
  let nearestEdge: MapEdge | null = null;
  for (const edge of graph.edges) {
    if (!canTraverse(edge, mode, graph.nodeById)) continue;
    const source = graph.nodeById.get(edge.source_id);
    const target = graph.nodeById.get(edge.target_id);
    if (!source || !target) continue;
    const pointOnEdge = getNearestPointOnSegment({ lat, lng }, source, target);
    const distance = getDistance(lat, lng, pointOnEdge.lat, pointOnEdge.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = pointOnEdge;
      nearestEdge = edge;
    }
  }
  return { nearestPoint, nearestEdge, distance: minDistance };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Route request was cancelled", "AbortError");
  }
}

export function findPreparedPath(
  graph: PreparedRouteGraph,
  startNodeId: string,
  endNodeId: string,
  mode: TransportMode,
  signal?: AbortSignal,
): PathResult | null {
  throwIfAborted(signal);
  if (startNodeId === endNodeId) {
    const node = graph.nodeById.get(startNodeId);
    return node ? { path: [node, node], totalDistance: 0, estimatedTime: 0 } : null;
  }
  if (!graph.nodeById.has(startNodeId) || !graph.nodeById.has(endNodeId)) return null;

  const openSet = new Set<string>([startNodeId]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startNodeId, 0]]);

  while (openSet.size) {
    throwIfAborted(signal);
    let currentId: string | null = null;
    let lowestScore = Infinity;
    for (const id of openSet) {
      const score = gScore.get(id) ?? Infinity;
      if (score < lowestScore) {
        lowestScore = score;
        currentId = id;
      }
    }
    if (!currentId) break;
    if (currentId === endNodeId) {
      const ids = [currentId];
      while (cameFrom.has(ids[0])) ids.unshift(cameFrom.get(ids[0])!);
      const path = ids.map((id) => graph.nodeById.get(id)).filter((node): node is MapNode => Boolean(node));
      const totalDistance = path.reduce(
        (total, node, index) => index ? total + getDistance(path[index - 1].lat, path[index - 1].lng, node.lat, node.lng) : total,
        0,
      );
      return { path, totalDistance, estimatedTime: calculateTime(totalDistance, mode) };
    }
    openSet.delete(currentId);
    const current = graph.nodeById.get(currentId);
    if (!current) continue;
    for (const edge of graph.adjacency.get(currentId) ?? []) {
      if (!canTraverse(edge, mode, graph.nodeById)) continue;
      const neighborId = edge.source_id === currentId ? edge.target_id : edge.source_id;
      const neighbor = graph.nodeById.get(neighborId);
      if (!neighbor) continue;
      const weight = edge.weight > 0 ? edge.weight : getDistance(current.lat, current.lng, neighbor.lat, neighbor.lng);
      const tentative = (gScore.get(currentId) ?? Infinity) + weight;
      if (tentative < (gScore.get(neighborId) ?? Infinity)) {
        cameFrom.set(neighborId, currentId);
        gScore.set(neighborId, tentative);
        openSet.add(neighborId);
      }
    }
  }
  return null;
}

export function createRouteEngine() {
  let prepared: PreparedRouteGraph | null = null;
  return {
    setGraph(nodes: readonly MapNode[], edges: readonly MapEdge[], revision: string): boolean {
      if (prepared?.revision === revision) return false;
      prepared = prepareRouteGraph(nodes, edges, revision);
      return true;
    },
    getGraph(): PreparedRouteGraph | null {
      return prepared;
    },
    async route(request: {
      startNodeId: string;
      endNodeId: string;
      mode: TransportMode;
      signal?: AbortSignal;
    }): Promise<PathResult | null> {
      throwIfAborted(request.signal);
      await Promise.resolve();
      throwIfAborted(request.signal);
      return prepared
        ? findPreparedPath(prepared, request.startNodeId, request.endNodeId, request.mode, request.signal)
        : null;
    },
  };
}
