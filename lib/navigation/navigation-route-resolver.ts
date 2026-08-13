import type { MapNode, PathResult, TransportMode } from "@/lib/types/graph";

type Point = { lat: number; lng: number };
type ExternalPath = (
  start: Point,
  end: Point,
  mode: TransportMode,
  signal?: AbortSignal,
) => Promise<PathResult | null>;

interface NavigationRouteDependencies {
  isInside: (point: Point) => boolean;
  findGate: (outside: Point, inside: Point) => MapNode;
  buildInternalRoute: (from: Point, to: Point, destinationId?: string) => PathResult | null | Promise<PathResult | null>;
  externalPath: ExternalPath;
  mergeAtGate: (
    firstPath: MapNode[],
    gate: MapNode,
    secondPath: MapNode[],
    mode: TransportMode,
  ) => PathResult;
  calculateTime: (distance: number, mode: TransportMode) => number;
}

export async function resolveNavigationRoute({
  start,
  end,
  destinationId,
  mode,
  signal,
  dependencies,
}: {
  start: Point;
  end: Point;
  destinationId?: string;
  mode: TransportMode;
  signal: AbortSignal;
  dependencies: NavigationRouteDependencies;
}): Promise<PathResult> {
  const startInside = dependencies.isInside(start);
  const endInside = dependencies.isInside(end);
  let result: PathResult | null = null;

  if (startInside && endInside) {
    result = await dependencies.buildInternalRoute(start, end, destinationId);
    if (!result) {
      result = await dependencies.externalPath(start, end, mode, signal);
    }
  } else if (!startInside && endInside) {
    const gate = dependencies.findGate(start, end);
    const internalRoute = await dependencies.buildInternalRoute(gate, end, destinationId);
    const externalRoute = await dependencies.externalPath(start, gate, mode, signal);
    if (!externalRoute || !internalRoute) {
      throw new Error("External routing provider could not resolve this route.");
    }
    result = dependencies.mergeAtGate(externalRoute.path, gate, internalRoute.path, mode);
  } else if (startInside && !endInside) {
    const gate = dependencies.findGate(end, start);
    const internalRoute = await dependencies.buildInternalRoute(start, gate);
    const externalRoute = await dependencies.externalPath(gate, end, mode, signal);
    if (!externalRoute || !internalRoute) {
      throw new Error("External routing provider could not resolve this route.");
    }
    result = dependencies.mergeAtGate(internalRoute.path, gate, externalRoute.path, mode);
  } else {
    const externalRoute = await dependencies.externalPath(start, end, mode, signal);
    if (!externalRoute) {
      throw new Error("External routing provider could not resolve this route.");
    }
    result = {
      ...externalRoute,
      estimatedTime:
        externalRoute.estimatedTime ??
        dependencies.calculateTime(externalRoute.totalDistance, mode),
    };
  }

  if (!result) throw new Error("External routing provider could not resolve this route.");
  return result;
}
