"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, Polyline, useMap } from "@/components/map/leaflet-react";
import { toast } from "sonner";
import type { LatLng, Polyline as LeafletPolyline } from "leaflet";
import { getDistance, isNodeClosed, calculateTime } from "@/lib/pathfinding/astar";
import { getExternalPath } from "@/lib/pathfinding/external";
import {
  findClosestTransitionGate,
  isPointInsideRoutingBoundary,
  mergePathsAtTransitionGate,
} from "@/lib/pathfinding/transition-gates";
import { resolveNavigationRoute } from "@/lib/navigation/navigation-route-resolver";
import { createRouteRequestCoordinator } from "@/lib/navigation/route-request-coordinator";
import {
  getRenderableRouteEndpoints,
  shouldAppendRequestedEndpoint,
} from "@/lib/navigation/route-endpoint";
import type { MapEdge, MapNode, PathResult, TransportMode } from "@/lib/types/graph";
import {
  createRouteEngine,
  findPreparedNearestEdge,
  getRouteGraphRevision,
  isPreparedNodeNavigable,
} from "@/lib/pathfinding/route-engine";
import type { NavigationOrigin, NavigationPoint } from "@/lib/map/map-runtime";
import {
  establishMapEvidenceCorrelation,
  registerRouteForEvidence,
  recordMapEvidenceEvent,
  throwIfMapEvidenceRouteFailureRequested,
  waitForMapEvidenceRouteDelay,
} from "@/lib/map/e2e-probe-bridge";

export interface NavigationRequestMetadata {
  destinationId: string | undefined;
  origin: NavigationOrigin;
  mode: TransportMode;
  start: NavigationPoint | null;
  end: NavigationPoint | null;
}

interface NavigationLayerProps {
  startPoint: LatLng | null;
  endPoint: LatLng | null;
  destinationId?: string;
  mode: TransportMode;
  nodes: MapNode[];
  edges: MapEdge[];
  waitingForUserLocation?: boolean;
  acquiringStart?: boolean;
  enabled?: boolean;
  navigationSessionId?: number;
  hasRouteFoundAnnouncement?: (sessionId: number) => boolean;
  claimRouteFoundAnnouncement?: (sessionId: number) => boolean;
  registerRouteFoundAnnouncement?: (sessionId: number, toastId: string) => void;
  releaseRouteFoundAnnouncement?: () => void;
  onRouteCommitted?: (route: PathResult, requestId: number, metadata: NavigationRequestMetadata) => void;
  onRouteFailed?: (message: string, requestId: number) => void;
  onRouteRequestStarted?: (requestId: number, metadata: NavigationRequestMetadata) => void;
  committedRoute?: PathResult | null;
  navigationOrigin?: NavigationOrigin | null;
  reuseCommittedRoute?: boolean;
}

export function NavigationLayer({
  startPoint,
  endPoint,
  destinationId,
  mode,
  nodes,
  edges,
  waitingForUserLocation,
  acquiringStart = false,
  enabled = true,
  navigationSessionId,
  hasRouteFoundAnnouncement,
  claimRouteFoundAnnouncement,
  registerRouteFoundAnnouncement,
  releaseRouteFoundAnnouncement,
  onRouteCommitted,
  onRouteFailed,
  onRouteRequestStarted,
  committedRoute = null,
  navigationOrigin = null,
  reuseCommittedRoute = false,
}: NavigationLayerProps) {
  const map = useMap();
  const routePolylineRef = useRef<LeafletPolyline>(null);
  const [readyRoutePolyline, setReadyRoutePolyline] = useState<LeafletPolyline | null>(null);
  const handleRoutePolylineReady = useCallback((polyline: LeafletPolyline | null) => {
    routePolylineRef.current = polyline;
    setReadyRoutePolyline(polyline);
  }, []);
  const routeEngine = useMemo(() => createRouteEngine(), []);
  const requestMetadata = useMemo<NavigationRequestMetadata>(() => ({
    destinationId,
    origin: navigationOrigin ?? (waitingForUserLocation ? "live" : "manual"),
    mode,
    start: startPoint ? { lat: startPoint.lat, lng: startPoint.lng } : null,
    end: endPoint ? { lat: endPoint.lat, lng: endPoint.lng } : null,
  }), [destinationId, endPoint, mode, navigationOrigin, startPoint, waitingForUserLocation]);
  const coordinator = useMemo(
    () =>
      createRouteRequestCoordinator<PathResult>({
        clear: () => undefined,
        publish: (result, requestId) => {
          if (requestId !== undefined) {
            recordMapEvidenceEvent("navigation-feedback", requestId);
            onRouteCommitted?.(result, requestId, requestMetadata);
          }
        },
        loading: (message, id) => toast.loading(message, { id }),
        success: (message, id) => toast.success(message, { id }),
        dismiss: (id) => toast.dismiss(id),
        error: (message, id) => {
          toast.error(message, { id });
        },
        reportError: (error, requestId) => {
          const message = error instanceof Error ? error.message : "No route found. External routing may be unavailable.";
          console.error("NavigationLayer: Process error", error);
          if (requestId !== undefined) {
            recordMapEvidenceEvent("navigation-feedback", requestId);
            onRouteFailed?.(message, requestId);
          }
        },
        requestStarted: (requestId) => {
          establishMapEvidenceCorrelation(navigationSessionId, requestId);
          recordMapEvidenceEvent("route-request", requestId);
          onRouteRequestStarted?.(requestId, requestMetadata);
        },
      }),
    [
      requestMetadata,
      navigationSessionId,
      onRouteCommitted,
      onRouteFailed,
      onRouteRequestStarted,
    ],
  );

  useEffect(() => {
    routeEngine.setGraph(nodes, edges, getRouteGraphRevision(nodes, edges));
  }, [edges, nodes, routeEngine]);

  useEffect(() => {
    if (!enabled || reuseCommittedRoute) {
      return coordinator.start({});
    }

    const isSuccessAnnounced =
      navigationSessionId === undefined || !hasRouteFoundAnnouncement
        ? undefined
        : () => hasRouteFoundAnnouncement(navigationSessionId);

    if (waitingForUserLocation) {
      return coordinator.start({
        loadingMessage: "Waiting for user location...",
        sessionId: navigationSessionId,
        isSuccessAnnounced,
      });
    }

    if (acquiringStart) {
      return coordinator.start({
        sessionId: navigationSessionId,
        requestId: navigationSessionId,
        isSuccessAnnounced,
      });
    }

    if (!startPoint || !endPoint || !nodes || nodes.length === 0 || !edges || edges.length === 0) {
      return coordinator.start({ sessionId: navigationSessionId, isSuccessAnnounced });
    }

    const preparedGraph = routeEngine.getGraph();
    if (!preparedGraph) return coordinator.start({ sessionId: navigationSessionId, isSuccessAnnounced });

    const makeNode = (id: string, point: { lat: number; lng: number }): MapNode => ({
      id,
      lat: point.lat,
      lng: point.lng,
      type: "node",
    });

    const snapToGraph = (lat: number, lng: number, isDestination = false, targetId?: string): string | null => {
      if (!preparedGraph.nodes.length || !preparedGraph.edges.length) return null;

      const isNavigable = (id: string) => isPreparedNodeNavigable(preparedGraph, id, mode, !isDestination);

      if (targetId) {
        const refLat = isDestination ? (startPoint?.lat ?? lat) : (endPoint?.lat ?? lat);
        const refLng = isDestination ? (startPoint?.lng ?? lng) : (endPoint?.lng ?? lng);

        const associatedEntries = (preparedGraph.buildingEntriesById.get(targetId) ?? [])
          .filter((node) => isNavigable(node.id))
          .map((node) => ({ id: node.id, dist: getDistance(refLat, refLng, node.lat, node.lng) }))
          .sort((a, b) => a.dist - b.dist);

        if (associatedEntries.length > 0) return associatedEntries[0].id;

        const anyAssociatedEntry = (preparedGraph.buildingEntriesById.get(targetId) ?? [])
          .slice()
          .sort((a, b) => getDistance(lat, lng, a.lat, a.lng) - getDistance(lat, lng, b.lat, b.lng))[0];

        if (anyAssociatedEntry) {
          const { nearestEdge } = findPreparedNearestEdge(preparedGraph, anyAssociatedEntry.lat, anyAssociatedEntry.lng, mode);
          if (nearestEdge) {
            const source = preparedGraph.nodeById.get(nearestEdge.source_id);
            const target = preparedGraph.nodeById.get(nearestEdge.target_id);
            if (source && target) {
              return getDistance(anyAssociatedEntry.lat, anyAssociatedEntry.lng, source.lat, source.lng) <
                getDistance(anyAssociatedEntry.lat, anyAssociatedEntry.lng, target.lat, target.lng)
                ? source.id
                : target.id;
            }
          }
        }
      }

      const nearbyFacilityEntries = preparedGraph.buildingEntries
        .filter((node) => isNavigable(node.id))
        .map((node) => ({ id: node.id, dist: getDistance(lat, lng, node.lat, node.lng) }))
        .filter((node) => node.dist <= 50)
        .sort((a, b) => a.dist - b.dist);

      if (nearbyFacilityEntries.length > 0) return nearbyFacilityEntries[0].id;

      const { nearestEdge } = findPreparedNearestEdge(preparedGraph, lat, lng, mode);

      if (nearestEdge) {
        const source = preparedGraph.nodeById.get(nearestEdge.source_id);
        const target = preparedGraph.nodeById.get(nearestEdge.target_id);

        if (source && target) {
          const sourceDistance = getDistance(lat, lng, source.lat, source.lng);
          const targetDistance = getDistance(lat, lng, target.lat, target.lng);
          return sourceDistance < targetDistance ? source.id : target.id;
        }
      }

      let nearestId: string | null = null;
      let minDist = Infinity;
      for (const node of preparedGraph.nodes) {
        if (!isPreparedNodeNavigable(preparedGraph, node.id, mode)) continue;
        const distance = getDistance(node.lat, node.lng, lat, lng);
        if (distance < minDist) {
          minDist = distance;
          nearestId = node.id;
        }
      }

      if (!nearestId) {
        for (const node of preparedGraph.nodes) {
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

    const buildInternalRoute = async (
      from: { lat: number; lng: number },
      to: { lat: number; lng: number },
      targetId?: string,
      signal?: AbortSignal,
    ): Promise<PathResult | null> => {
      if (signal?.aborted) {
        throw new DOMException("Route request was cancelled", "AbortError");
      }
      const startNodeId = snapToGraph(from.lat, from.lng, false);
      const endNodeId = snapToGraph(to.lat, to.lng, true, targetId);
      if (signal?.aborted) {
        throw new DOMException("Route request was cancelled", "AbortError");
      }
      if (!startNodeId || !endNodeId) return null;

      const route = await routeEngine.route({ startNodeId, endNodeId, mode, signal });
      if (!route) return null;

      const startNode = makeNode("route-start", from);
      const endNode = makeNode("route-end", to);
      const snappedEndNode = preparedGraph.nodeById.get(endNodeId);
      const destinationHasBuildingEntries = Boolean(targetId && preparedGraph.buildingEntriesById.has(targetId));
      const finalPath = [startNode, ...route.path];

      if (shouldAppendRequestedEndpoint({
        destinationHasBuildingEntries,
        snappedNodeType: snappedEndNode?.type,
      })) {
        finalPath.push(endNode);
      }

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
      await waitForMapEvidenceRouteDelay(signal);
      throwIfMapEvidenceRouteFailureRequested(signal);
      const start = { lat: startPoint.lat, lng: startPoint.lng };
      const end = { lat: endPoint.lat, lng: endPoint.lng };
      return resolveNavigationRoute({
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
      onError: releaseRouteFoundAnnouncement,
      resolve: resolveRoute,
    });
  }, [startPoint, endPoint, nodes, edges, mode, waitingForUserLocation, acquiringStart, enabled, reuseCommittedRoute, destinationId, navigationSessionId, hasRouteFoundAnnouncement, claimRouteFoundAnnouncement, registerRouteFoundAnnouncement, releaseRouteFoundAnnouncement, coordinator, routeEngine]);

  useEffect(() => {
    const path = committedRoute?.path;
    const polyline = readyRoutePolyline;
    if (!path || !polyline) return;
    return registerRouteForEvidence({ map, polyline, path });
  }, [committedRoute?.path, map, readyRoutePolyline]);

  if (!committedRoute) return null;
  const routeEndpoints = getRenderableRouteEndpoints(committedRoute.path);
  if (!routeEndpoints) return null;

  return (
    <>
      <Polyline
        ref={routePolylineRef}
        onReady={handleRoutePolylineReady}
        positions={committedRoute.path.map((node) => [node.lat, node.lng])}
        pathOptions={{ color: "#3b82f6", weight: 5, opacity: 0.9, className: "map-route-line" }}
      />
      <CircleMarker
        center={[routeEndpoints.start.lat, routeEndpoints.start.lng]}
        radius={6}
        pathOptions={{ color: "green", fillColor: "green", fillOpacity: 1, className: "map-route-start" }}
      />
      <CircleMarker
        center={[routeEndpoints.end.lat, routeEndpoints.end.lng]}
        radius={6}
        pathOptions={{ color: "red", fillColor: "red", fillOpacity: 1, className: "map-route-end" }}
      />
    </>
  );
}
