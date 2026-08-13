import type { MapEdge, MapNode, PathResult, TransportMode } from "@/lib/types/graph";
import { calculateTime, getDistance, isEdgeClosed, isNodeClosed } from "./astar";

export interface PreparedRouteGraph {
  revision: string;
  nodeById: ReadonlyMap<string, MapNode>;
  adjacency: ReadonlyMap<string, readonly MapEdge[]>;
}

export function getRouteGraphRevision(
  nodes: readonly MapNode[],
  edges: readonly MapEdge[],
): string {
  const nodePart = nodes
    .map((node) => `${node.id}:${node.lat}:${node.lng}:${node.type}:${node.is_closed ? 1 : 0}`)
    .sort()
    .join("|");
  const edgePart = edges
    .map((edge) => `${edge.id}:${edge.source_id}:${edge.target_id}:${edge.weight}:${edge.bidirectional ? 1 : 0}:${edge.type}:${edge.is_closed ? 1 : 0}`)
    .sort()
    .join("|");
  return `${nodePart}#${edgePart}`;
}

export function prepareRouteGraph(
  nodes: readonly MapNode[],
  edges: readonly MapEdge[],
  revision: string,
): PreparedRouteGraph {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, MapEdge[]>();
  for (const edge of edges) {
    adjacency.get(edge.source_id)?.push(edge) ?? adjacency.set(edge.source_id, [edge]);
    if (edge.bidirectional) {
      adjacency.get(edge.target_id)?.push(edge) ?? adjacency.set(edge.target_id, [edge]);
    }
  }
  return { revision, nodeById, adjacency };
}

function canTraverse(edge: MapEdge, mode: TransportMode, nodeById: ReadonlyMap<string, MapNode>): boolean {
  if (isEdgeClosed(edge)) return false;
  const source = nodeById.get(edge.source_id);
  const target = nodeById.get(edge.target_id);
  if (!source || !target || isNodeClosed(source) || isNodeClosed(target)) return false;
  if (edge.access?.length) return edge.access.includes(mode);
  return edge.type === "road" ? true : mode === "walking";
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
