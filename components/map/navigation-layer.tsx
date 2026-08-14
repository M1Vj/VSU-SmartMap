"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { resolveNavigationRoute } from "@/lib/navigation/navigation-route-resolver";
import { createRouteRequestCoordinator } from "@/lib/navigation/route-request-coordinator";
import { recordMapPerformance } from "@/lib/map/performance";
import type { RouteRequestContext } from "@/lib/navigation/route-commit-state";
import type { MapEdge, MapNode, PathResult, TransportMode } from "@/lib/types/graph";

interface NavigationLayerProps {
  startPoint: LatLng | null;
  endPoint: LatLng | null;
  destinationId?: string;
  mode: TransportMode;
  nodes: MapNode[];
  edges: MapEdge[];
  waitingForUserLocation?: boolean;
  navigationSessionId?: number;
  hasRouteFoundAnnouncement?: (sessionId: number) => boolean;
  claimRouteFoundAnnouncement?: (sessionId: number) => boolean;
  registerRouteFoundAnnouncement?: (sessionId: number, toastId: string) => void;
  releaseRouteFoundAnnouncement?: () => void;
  navigationOrigin?: RouteRequestContext["origin"];
  reuseCommittedRoute?: boolean;
  onRouteRequest?: (context: RouteRequestContext | null) => void;
  onRouteRequestFailed?: () => void;
  onRoutesFound?: (routes: PathResult[], context?: RouteRequestContext) => void;
}

export function NavigationLayer({
  startPoint,
  endPoint,
  destinationId,
  mode,
  nodes,
  edges,
  waitingForUserLocation,
  navigationSessionId,
  hasRouteFoundAnnouncement,
  claimRouteFoundAnnouncement,
  registerRouteFoundAnnouncement,
  releaseRouteFoundAnnouncement,
  navigationOrigin = null,
  reuseCommittedRoute = false,
  onRouteRequest,
  onRouteRequestFailed,
  onRoutesFound,
}: NavigationLayerProps) {
  const [path, setPath] = useState<PathResult | null>(null);
  const [requestContextStore] = useState<{ current: RouteRequestContext | null }>(() => ({ current: null }));
  const publishRoute = useCallback((result: PathResult) => {
    setPath(result);
    const context = requestContextStore.current;
    if (context) onRoutesFound?.([result], context);
  }, [onRoutesFound, requestContextStore]);
  const coordinator = useMemo(
    () =>
      createRouteRequestCoordinator<PathResult>({
        clear: ({ preservePublishedResult = false } = {}) => {
          if (preservePublishedResult) return;
          setPath(null);
          onRoutesFound?.([]);
        },
        publish: publishRoute,
        loading: (message, id) => toast.loading(message, { id }),
        success: (message, id) => toast.success(message, { id }),
        error: (message, id) => toast.error(message, { id }),
        dismiss: (id) => toast.dismiss(id),
        reportError: (error) => console.error("NavigationLayer: Process error", error),
      }),
    [onRoutesFound, publishRoute],
  );

  useEffect(() => {
    const isSuccessAnnounced =
      navigationSessionId === undefined || !hasRouteFoundAnnouncement
        ? undefined
        : () => hasRouteFoundAnnouncement(navigationSessionId);

    if (reuseCommittedRoute) {
      return coordinator.start({
        sessionId: navigationSessionId,
        preservePublishedResult: true,
      });
    }

    if (waitingForUserLocation) {
      // eslint-disable-next-line react-hooks/immutability
      requestContextStore.current = {
        destinationId: destinationId ?? null,
        start: null,
        end: endPoint ? { lat: endPoint.lat, lng: endPoint.lng } : null,
        mode,
        origin: navigationOrigin,
      };
      onRouteRequest?.(requestContextStore.current);
      return coordinator.start({
        loadingMessage: "Waiting for user location...",
        sessionId: navigationSessionId,
        isSuccessAnnounced,
        preservePublishedResult: Boolean(startPoint || endPoint || destinationId),
      });
    }

    if (!startPoint || !endPoint || !nodes || nodes.length === 0 || !edges || edges.length === 0) {
      requestContextStore.current = endPoint || destinationId
        ? {
            destinationId: destinationId ?? null,
            start: startPoint ? { lat: startPoint.lat, lng: startPoint.lng } : null,
            end: endPoint ? { lat: endPoint.lat, lng: endPoint.lng } : null,
            mode,
            origin: navigationOrigin,
          }
        : null;
      onRouteRequest?.(requestContextStore.current);
      return coordinator.start({
        sessionId: navigationSessionId,
        isSuccessAnnounced,
        preservePublishedResult: Boolean(startPoint || endPoint || destinationId),
      });
    }

    requestContextStore.current = {
      destinationId: destinationId ?? null,
      start: { lat: startPoint.lat, lng: startPoint.lng },
      end: { lat: endPoint.lat, lng: endPoint.lng },
      mode,
      origin: navigationOrigin,
    };
    onRouteRequest?.(requestContextStore.current);

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

    const resolveRoute = async (signal: AbortSignal): Promise<PathResult> => {
      const startedAt = typeof performance !== "undefined" ? performance.now() : null;
      const start = { lat: startPoint.lat, lng: startPoint.lng };
      const end = { lat: endPoint.lat, lng: endPoint.lng };
      const result = await resolveNavigationRoute({
        start,
        end,
        destinationId,
        mode,
        signal,
        dependencies: {
          isInside: isPointInsideRoutingBoundary,
          findGate: (outside, inside) => findClosestTransitionGate(outside, inside, nodes),
          buildInternalRoute,
          externalPath: getExternalPath,
          mergeAtGate: mergePathsAtTransitionGate,
          calculateTime,
        },
      });
      if (startedAt !== null && !signal.aborted) {
        recordMapPerformance("route_calculation", Math.max(0, performance.now() - startedAt));
      }
      return result;
    };

    return coordinator.start({
      loadingMessage: "Loading route...",
      sessionId: navigationSessionId,
      isSuccessAnnounced,
      shouldAnnounceSuccess:
        navigationSessionId === undefined || !claimRouteFoundAnnouncement
          ? undefined
          : () => claimRouteFoundAnnouncement(navigationSessionId),
      onSuccess:
        navigationSessionId === undefined || !registerRouteFoundAnnouncement
          ? undefined
          : (toastId) => registerRouteFoundAnnouncement(navigationSessionId, toastId),
      onError: () => {
          releaseRouteFoundAnnouncement?.();
          onRouteRequestFailed?.();
        },
        preservePublishedResult: true,
        resolve: resolveRoute,
      });
  }, [startPoint, endPoint, nodes, edges, mode, waitingForUserLocation, destinationId, navigationOrigin, navigationSessionId, reuseCommittedRoute, hasRouteFoundAnnouncement, claimRouteFoundAnnouncement, registerRouteFoundAnnouncement, releaseRouteFoundAnnouncement, onRouteRequest, onRouteRequestFailed, coordinator, requestContextStore]);

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
