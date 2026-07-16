"use client";

import { useEffect, useRef, useState } from "react";
import { CircleMarker, Polyline } from "@/components/map/leaflet-react";
import { toast } from "sonner";
import type { LatLng } from "leaflet";
import { findPath, findNearestEdge, getDistance, isNodeClosed, isNodeNavigable, calculateTime } from "@/lib/pathfinding/astar";
import { getExternalPath } from "@/lib/pathfinding/external";
import {
  findClosestTransitionGate,
  isPointInsideRoutingBoundary,
  mergePathsAtTransitionGate,
} from "@/lib/pathfinding/transition-gates";
import { canUseStraightRouteFallback } from "@/lib/navigation/external-route-policy";
import type { MapEdge, MapNode, PathResult, TransportMode } from "@/lib/types/graph";

const TOAST_ID = "navigation-status";

interface NavigationLayerProps {
  startPoint: LatLng | null;
  endPoint: LatLng | null;
  destinationId?: string;
  mode: TransportMode;
  nodes: MapNode[];
  edges: MapEdge[];
  waitingForUserLocation?: boolean;
  onRoutesFound?: (routes: PathResult[]) => void;
}

export function NavigationLayer({
  startPoint,
  endPoint,
  destinationId,
  mode,
  nodes,
  edges,
  waitingForUserLocation,
  onRoutesFound,
}: NavigationLayerProps) {
  const [path, setPath] = useState<PathResult | null>(null);
  const hasShownToastRef = useRef(false);

  useEffect(() => {
    hasShownToastRef.current = false;
    setPath(null);
  }, [endPoint?.lat, endPoint?.lng, destinationId, mode]);

  useEffect(() => {
    if (waitingForUserLocation) {
      if (!hasShownToastRef.current) toast.loading("Waiting for user location...", { id: TOAST_ID });
      setPath(null);
      onRoutesFound?.([]);
      return;
    }

    if (!startPoint || !endPoint) {
      setPath(null);
      onRoutesFound?.([]);
      return;
    }

    const makeNode = (id: string, point: { lat: number; lng: number }): MapNode => ({
      id,
      lat: point.lat,
      lng: point.lng,
      type: "node",
    });

    const snapToGraph = (lat: number, lng: number, isDestination = false, targetId?: string): string | null => {
      if (!nodes || nodes.length === 0 || !edges || edges.length === 0) return null;

      const isNavigable = (id: string) => isNodeNavigable(id, mode, nodes, edges, !isDestination);

      if (targetId) {
        const refLat = isDestination ? (startPoint?.lat ?? lat) : (endPoint?.lat ?? lat);
        const refLng = isDestination ? (startPoint?.lng ?? lng) : (endPoint?.lng ?? lng);

        const associatedEntries = nodes
          .filter((node) => node.type === "building_entry" && node.building_ids?.includes(targetId) && isNavigable(node.id))
          .map((node) => ({ id: node.id, dist: getDistance(refLat, refLng, node.lat, node.lng) }))
          .sort((a, b) => a.dist - b.dist);

        if (associatedEntries.length > 0) return associatedEntries[0].id;

        const anyAssociatedEntry = nodes
          .filter((node) => node.type === "building_entry" && node.building_ids?.includes(targetId))
          .sort((a, b) => getDistance(lat, lng, a.lat, a.lng) - getDistance(lat, lng, b.lat, b.lng))[0];

        if (anyAssociatedEntry) {
          const { nearestEdge } = findNearestEdge(anyAssociatedEntry.lat, anyAssociatedEntry.lng, nodes, edges, mode);
          if (nearestEdge) {
            const source = nodes.find((node) => node.id === nearestEdge.source_id);
            const target = nodes.find((node) => node.id === nearestEdge.target_id);
            if (source && target) {
              return getDistance(anyAssociatedEntry.lat, anyAssociatedEntry.lng, source.lat, source.lng) <
                getDistance(anyAssociatedEntry.lat, anyAssociatedEntry.lng, target.lat, target.lng)
                ? source.id
                : target.id;
            }
          }
        }
      }

      const nearbyFacilityEntries = nodes
        .filter((node) => node.type === "building_entry" && isNavigable(node.id))
        .map((node) => ({ id: node.id, dist: getDistance(lat, lng, node.lat, node.lng) }))
        .filter((node) => node.dist <= 50)
        .sort((a, b) => a.dist - b.dist);

      if (nearbyFacilityEntries.length > 0) return nearbyFacilityEntries[0].id;

      const { nearestEdge } = findNearestEdge(lat, lng, nodes, edges, mode);

      if (nearestEdge) {
        const source = nodes.find((node) => node.id === nearestEdge.source_id);
        const target = nodes.find((node) => node.id === nearestEdge.target_id);

        if (source && target) {
          const sourceDistance = getDistance(lat, lng, source.lat, source.lng);
          const targetDistance = getDistance(lat, lng, target.lat, target.lng);
          return sourceDistance < targetDistance ? source.id : target.id;
        }
      }

      let nearestId: string | null = null;
      let minDist = Infinity;
      const navigableNodeIds = new Set<string>();

      for (const edge of edges) {
        const hasAccess =
          edge.access && edge.access.length > 0
            ? edge.access.includes(mode)
            : mode === "walking" || edge.type === "road";

        if (hasAccess) {
          navigableNodeIds.add(edge.source_id);
          navigableNodeIds.add(edge.target_id);
        }
      }

      for (const node of nodes) {
        if (!navigableNodeIds.has(node.id) || isNodeClosed(node)) continue;
        const distance = getDistance(node.lat, node.lng, lat, lng);
        if (distance < minDist) {
          minDist = distance;
          nearestId = node.id;
        }
      }

      if (!nearestId) {
        for (const node of nodes) {
          if (isNodeClosed(node)) continue;
          const distance = getDistance(node.lat, node.lng, lat, lng);
          if (distance < minDist) {
            minDist = distance;
            nearestId = node.id;
          }
        }
      }

      return nearestId;
    };

    const buildInternalRoute = (
      from: { lat: number; lng: number },
      to: { lat: number; lng: number },
      targetId?: string
    ): PathResult | null => {
      const startNodeId = snapToGraph(from.lat, from.lng, false);
      const endNodeId = snapToGraph(to.lat, to.lng, true, targetId);
      if (!startNodeId || !endNodeId) return null;

      const route = findPath(nodes, edges, startNodeId, endNodeId, mode);
      if (!route) return null;

      const startNode = makeNode("route-start", from);
      const endNode = makeNode("route-end", to);
      const endSnappedToEntry = nodes.find((node) => node.id === endNodeId)?.type === "building_entry";
      const finalPath = [startNode, ...route.path];

      if (!endSnappedToEntry) finalPath.push(endNode);

      let totalDistance = 0;
      for (let i = 0; i < finalPath.length - 1; i++) {
        totalDistance += getDistance(finalPath[i].lat, finalPath[i].lng, finalPath[i + 1].lat, finalPath[i + 1].lng);
      }

      return {
        path: finalPath,
        totalDistance,
        estimatedTime: calculateTime(totalDistance, mode),
      };
    };

    const straightRoute = (from: { lat: number; lng: number }, to: { lat: number; lng: number }): PathResult => {
      const totalDistance = getDistance(from.lat, from.lng, to.lat, to.lng);
      return {
        path: [makeNode("route-start", from), makeNode("route-end", to)],
        totalDistance,
        estimatedTime: calculateTime(totalDistance, mode),
      };
    };

    const resolveRoute = async () => {
      if (!nodes || nodes.length === 0 || !edges || edges.length === 0) return;

      if (!hasShownToastRef.current) toast.loading("Loading route...", { id: TOAST_ID });

      const start = { lat: startPoint.lat, lng: startPoint.lng };
      const end = { lat: endPoint.lat, lng: endPoint.lng };
      const startInside = isPointInsideRoutingBoundary(start);
      const endInside = isPointInsideRoutingBoundary(end);

      try {
        let result: PathResult | null = null;

        if (startInside && endInside) {
          result = buildInternalRoute(start, end, destinationId);
          if (
            !result &&
            canUseStraightRouteFallback({
              startInsideRoutingBoundary: startInside,
              endInsideRoutingBoundary: endInside,
            })
          ) {
            result = straightRoute(start, end);
          }
        } else if (!startInside && endInside) {
          const gate = findClosestTransitionGate(start, end, nodes);
          const externalPromise = getExternalPath(start, gate, mode);
          const internalRoute = buildInternalRoute(gate, end, destinationId);
          const externalRoute = await externalPromise;
          if (!externalRoute || !internalRoute) {
            throw new Error("External routing provider could not resolve this route.");
          }
          result = mergePathsAtTransitionGate(
            externalRoute.path,
            gate,
            internalRoute.path,
            mode
          );
        } else if (startInside && !endInside) {
          const gate = findClosestTransitionGate(end, start, nodes);
          const externalPromise = getExternalPath(gate, end, mode);
          const internalRoute = buildInternalRoute(start, gate);
          const externalRoute = await externalPromise;
          if (!externalRoute || !internalRoute) {
            throw new Error("External routing provider could not resolve this route.");
          }
          result = mergePathsAtTransitionGate(
            internalRoute.path,
            gate,
            externalRoute.path,
            mode
          );
        } else {
          const externalRoute = await getExternalPath(start, end, mode);
          if (!externalRoute) {
            throw new Error("External routing provider could not resolve this route.");
          }
          result = {
            ...externalRoute,
            estimatedTime:
              externalRoute.estimatedTime ?? calculateTime(externalRoute.totalDistance, mode),
          };
        }

        if (!result) {
          throw new Error("No route could be resolved.");
        }

        setPath(result);
        onRoutesFound?.([result]);

        if (!hasShownToastRef.current) {
          toast.success("Route found!", { id: TOAST_ID });
          hasShownToastRef.current = true;
        }
      } catch (error) {
        console.error("NavigationLayer: Process error", error);
        setPath(null);
        onRoutesFound?.([]);
        if (!hasShownToastRef.current) {
          toast.error("No route found. External routing may be unavailable.", { id: TOAST_ID });
          hasShownToastRef.current = true;
        }
      }
    };

    resolveRoute();
  }, [startPoint, endPoint, nodes, edges, mode, waitingForUserLocation, destinationId, onRoutesFound]);

  if (!path) return null;

  return (
    <>
      <Polyline
        positions={path.path.map((node) => [node.lat, node.lng])}
        pathOptions={{ color: "#3b82f6", weight: 5, opacity: 0.9 }}
      />
      <CircleMarker
        center={[path.path[0].lat, path.path[0].lng]}
        radius={6}
        pathOptions={{ color: "green", fillColor: "green", fillOpacity: 1 }}
      />
      <CircleMarker
        center={[path.path[path.path.length - 1].lat, path.path[path.path.length - 1].lng]}
        radius={6}
        pathOptions={{ color: "red", fillColor: "red", fillOpacity: 1 }}
      />
    </>
  );
}
