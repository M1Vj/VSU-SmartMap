"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMap } from "@/components/map/leaflet-react";
import { getViewAfterDeselect, type MapViewState } from "@/lib/map/selection-view";
import { getMapCameraPolicy } from "@/lib/navigation/map-camera-policy";
import type { MapItem } from "@/lib/types/map";
import { MapMarkers } from "./map-markers";
import { focusConnectedMarker } from "@/lib/map/marker-focus";
import { createInteractionGateway } from "@/lib/map/interaction-gateway";
import { shouldHandleMapSelectionEscape } from "@/lib/map/popup-lifecycle";
import { markMapPerformance } from "@/lib/map/performance-marks";
import { recordMapEvidenceEvent } from "@/lib/map/e2e-probe-bridge";
import {
  createPointerActivation,
  isPrimaryPointerActivation,
  isPointerTap,
  shouldDedupeCompatibilityClick,
  type CompatibilityActivationRecord,
  type PointerActivation,
  type PointerActivationEvent,
} from "@/lib/map/pointer-activation";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const MAP_INTERACTIVE_SELECTOR = [
  "[data-map-control]",
  ".leaflet-control",
  ".leaflet-marker-icon",
  ".leaflet-popup",
  ".leaflet-tooltip",
  ".leaflet-interactive",
].join(",");

function rememberAcceptedActivation(activations: Set<string>, activationId: string) {
  if (activations.has(activationId)) return false;
  activations.add(activationId);
  if (activations.size > 100) {
    const oldest = activations.values().next().value;
    if (oldest !== undefined) activations.delete(oldest);
  }
  return true;
}

class InteractionCallbackRegistry {
  private items: readonly MapItem[];
  private onSelect: (item: MapItem) => void;
  private onMarkerTapOverride?: (item: MapItem) => void;
  private onClearSelection?: () => void;
  private onMapClick?: (point: { lat: number; lng: number }) => void;
  private onDirections?: (item: MapItem) => number | null;

  constructor({
    items,
    onSelect,
    onMarkerTapOverride,
    onClearSelection,
    onMapClick,
    onDirections,
  }: Pick<MapSelectionLayerProps, "items" | "onSelect" | "onMarkerTapOverride" | "onClearSelection" | "onMapClick" | "onDirections">) {
    this.items = items;
    this.onSelect = onSelect;
    this.onMarkerTapOverride = onMarkerTapOverride;
    this.onClearSelection = onClearSelection;
    this.onMapClick = onMapClick;
    this.onDirections = onDirections;
  }

  update({
    items,
    onSelect,
    onMarkerTapOverride,
    onClearSelection,
    onMapClick,
    onDirections,
  }: Pick<MapSelectionLayerProps, "items" | "onSelect" | "onMarkerTapOverride" | "onClearSelection" | "onMapClick" | "onDirections">) {
    this.items = items;
    this.onSelect = onSelect;
    this.onMarkerTapOverride = onMarkerTapOverride;
    this.onClearSelection = onClearSelection;
    this.onMapClick = onMapClick;
    this.onDirections = onDirections;
  }

  marker(itemId: string) {
    const item = this.items.find((candidate) => candidate.id === itemId);
    if (!item) return;
    if (this.onMarkerTapOverride) {
      this.onMarkerTapOverride(item);
      return;
    }
    this.onSelect(item);
  }

  background(point?: { lat: number; lng: number }) {
    if (point && this.onMapClick) {
      this.onMapClick(point);
      return;
    }
    this.onClearSelection?.();
  }

  directions(item: MapItem) {
    return this.onDirections?.(item) ?? null;
  }
}

type MapSelectionLayerProps = {
  items: readonly MapItem[];
  selectedId: string | null;
  routeDestinationId?: string | null;
  minimizeNonDestinationMarkers?: boolean;
  protectedMarkerIds?: ReadonlySet<string>;
  onSelect: (item: MapItem) => void;
  onMarkerTapOverride?: (item: MapItem) => void;
  onDirections?: (item: MapItem) => number | null;
  onMapClick?: (point: { lat: number; lng: number }) => void;
  onClearSelection?: () => void;
  flyZoom?: number;
  navigationOwnsViewport?: boolean;
};

export function MapSelectionLayer({
  items,
  selectedId,
  routeDestinationId = null,
  minimizeNonDestinationMarkers = false,
  protectedMarkerIds,
  onSelect,
  onMarkerTapOverride,
  onDirections,
  onMapClick,
  onClearSelection,
  flyZoom = 19,
  navigationOwnsViewport = false,
}: MapSelectionLayerProps) {
  const map = useMap();
  const prevSelectedId = useRef<string | null>(null);
  const previousViewRef = useRef<MapViewState | null>(null);
  const backgroundPointerRef = useRef<PointerActivation | null>(null);
  const backgroundCompatibilityRef = useRef<CompatibilityActivationRecord | null>(null);
  const backgroundCancelledAtRef = useRef<number | null>(null);
  const acceptedMarkerActivationsRef = useRef<Set<string>>(new Set());
  const acceptedBackgroundActivationsRef = useRef<Set<string>>(new Set());
  const keyboardSelectedMarkerIdRef = useRef<string | null>(null);
  const escapeFocusFrameRef = useRef<number | null>(null);
  const selectedIdRef = useRef(selectedId);
  const onClearSelectionRef = useRef(onClearSelection);
  selectedIdRef.current = selectedId;
  onClearSelectionRef.current = onClearSelection;
  const mapReadyStartedAtRef = useRef(
    typeof performance === "undefined" ? Date.now() : performance.now(),
  );
  const mapReadyMarkedRef = useRef(false);
  const [zoom, setZoom] = useState(() => map.getZoom());
  const [interactionRegistry] = useState(
    () => new InteractionCallbackRegistry({ items, onSelect, onMarkerTapOverride, onClearSelection, onMapClick, onDirections }),
  );
  useIsomorphicLayoutEffect(() => {
    interactionRegistry.update({ items, onSelect, onMarkerTapOverride, onClearSelection, onMapClick, onDirections });
  }, [interactionRegistry, items, onClearSelection, onDirections, onMapClick, onMarkerTapOverride, onSelect]);
  const [interactionGateway] = useState(
    () => createInteractionGateway({
      onMarkerActivate: (itemId) => interactionRegistry.marker(itemId),
      onBackground: (point) => interactionRegistry.background(point),
    }),
  );

  useEffect(() => () => {
    acceptedMarkerActivationsRef.current.clear();
    acceptedBackgroundActivationsRef.current.clear();
    if (escapeFocusFrameRef.current !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(escapeFocusFrameRef.current);
    }
    escapeFocusFrameRef.current = null;
    keyboardSelectedMarkerIdRef.current = null;
  }, []);

  useEffect(() => {
    if (mapReadyMarkedRef.current) return;
    let cancelled = false;
    let frameId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const markReadyAfterFrame = () => {
      if (cancelled || mapReadyMarkedRef.current) return;
      mapReadyMarkedRef.current = true;
      markMapPerformance(
        "map-ready",
        mapReadyStartedAtRef.current,
        typeof performance === "undefined" ? Date.now() : performance.now(),
      );
    };

    const handleReady = () => {
      if (typeof requestAnimationFrame === "function") {
        frameId = requestAnimationFrame(markReadyAfterFrame);
      } else {
        timeoutId = setTimeout(markReadyAfterFrame, 0);
      }
    };

    map.whenReady(handleReady);
    return () => {
      cancelled = true;
      map.off("load", handleReady);
      if (frameId !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frameId);
      }
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [map]);

  const getCurrentView = useCallback(() => ({
    center: {
      lat: map.getCenter().lat,
      lng: map.getCenter().lng,
    },
    zoom: map.getZoom(),
  }), [map]);

  const handleMarkerActivate = useCallback((item: MapItem, activationId: string, modality: "mouse" | "touch" | "pen" | "keyboard") => {
    keyboardSelectedMarkerIdRef.current = modality === "keyboard" ? item.id : null;
    interactionGateway.dispatch({ type: "marker", itemId: item.id, activationId, modality });
    if (rememberAcceptedActivation(acceptedMarkerActivationsRef.current, activationId)) {
      recordMapEvidenceEvent("marker-activation", activationId, modality);
    }
  }, [interactionGateway]);
  useEffect(() => {
    if (keyboardSelectedMarkerIdRef.current !== selectedId) {
      keyboardSelectedMarkerIdRef.current = null;
    }
  }, [selectedId]);
  const handleMarkerSelect = useCallback((item: MapItem) => {
    interactionRegistry.marker(item.id);
  }, [interactionRegistry]);
  const handleMarkerDeselect = useCallback(() => {
    interactionRegistry.background();
  }, [interactionRegistry]);
  const handleMarkerDirections = useCallback((item: MapItem) => {
    return interactionRegistry.directions(item);
  }, [interactionRegistry]);

  const handlePlainMapInteraction = useCallback((
    target: HTMLElement | null,
    point: { lat: number; lng: number } | undefined,
    activationId: string,
    modality: "mouse" | "touch" | "pen" | "keyboard" = "mouse",
  ) => {
    if (!target) {
      return;
    }

    if (target.closest(MAP_INTERACTIVE_SELECTOR)) {
      return;
    }

    interactionGateway.dispatch({ type: "background", target: "background", activationId, point });
    if (rememberAcceptedActivation(acceptedBackgroundActivationsRef.current, activationId)) {
      recordMapEvidenceEvent("background-activation", activationId, modality);
    }
  }, [interactionGateway]);

  useEffect(() => {
    const container = map.getContainer();

    const handleZoomEnd = () => {
      setZoom(map.getZoom());
    };

    const closeOpenTooltip = () => {
      map.eachLayer((layer) => {
        const tooltipLayer = layer as {
          closeTooltip?: () => void;
          getTooltip?: () => unknown;
        };

        if (tooltipLayer.getTooltip?.() && tooltipLayer.closeTooltip) {
          tooltipLayer.closeTooltip();
        }
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        !target ||
        !container.contains(target) ||
        target.closest(MAP_INTERACTIVE_SELECTOR) ||
        !isPrimaryPointerActivation(event as PointerActivationEvent)
      ) {
        backgroundPointerRef.current = null;
        return;
      }

      backgroundCancelledAtRef.current = null;
      backgroundPointerRef.current = createPointerActivation(
        "background",
        event as PointerActivationEvent,
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      const activation = backgroundPointerRef.current;
      backgroundPointerRef.current = null;
      if (
        !activation ||
        !isPrimaryPointerActivation(event as PointerActivationEvent) ||
        !isPointerTap(activation, event as PointerActivationEvent)
      ) {
        if (activation) backgroundCancelledAtRef.current = Date.now();
        return;
      }

      const target = event.target as HTMLElement | null;
      if (!target || !container.contains(target) || target.closest(MAP_INTERACTIVE_SELECTOR)) {
        return;
      }

      const latlng = map.mouseEventToLatLng(event as unknown as MouseEvent);
      const modality = activation.pointerType;
      backgroundCompatibilityRef.current = {
        activationId: activation.activationId,
        modality,
        pointerId: event.pointerId,
        at: Date.now(),
      };
      handlePlainMapInteraction(
        target,
        { lat: latlng.lat, lng: latlng.lng },
        activation.activationId,
        modality,
      );
    };

    const handlePointerCancel = () => {
      backgroundPointerRef.current = null;
      backgroundCompatibilityRef.current = null;
      backgroundCancelledAtRef.current = Date.now();
    };

    const handleClick = (event: MouseEvent) => {
      const pointerEvent = event as MouseEvent & { pointerId?: number; pointerType?: string };
      const target = event.target as HTMLElement | null;
      if (target && !container.contains(target)) {
        return;
      }
      if (!target || target.closest(MAP_INTERACTIVE_SELECTOR)) {
        return;
      }

      const now = Date.now();
      const cancelledAt = backgroundCancelledAtRef.current;
      if (cancelledAt !== null) {
        backgroundCancelledAtRef.current = null;
        backgroundCompatibilityRef.current = null;
        if (now - cancelledAt < 700) return;
      }
      const compatibility = backgroundCompatibilityRef.current;
      const isCompatibility = compatibility
        ? shouldDedupeCompatibilityClick(
            compatibility,
            { pointerId: pointerEvent.pointerId, detail: event.detail },
            now,
          )
        : false;
      backgroundCompatibilityRef.current = null;
      const activationId = isCompatibility
        ? compatibility?.activationId ?? `background:click:${event.timeStamp}`
        : `background:click:${pointerEvent.pointerId ?? "mouse"}:${event.timeStamp}`;
      const latlng = map.mouseEventToLatLng(event);
      handlePlainMapInteraction(
        target,
        { lat: latlng.lat, lng: latlng.lng },
        activationId,
        pointerEvent.pointerType === "touch" || pointerEvent.pointerType === "pen"
          ? pointerEvent.pointerType
          : "mouse",
      );
    };

    map.on("zoomend", handleZoomEnd);
    map.on("zoomstart", closeOpenTooltip);
    map.on("movestart", closeOpenTooltip);
    map.on("dragstart", closeOpenTooltip);
    container.addEventListener("pointerdown", handlePointerDown, true);
    container.addEventListener("pointerup", handlePointerUp, true);
    container.addEventListener("pointercancel", handlePointerCancel, true);
    container.addEventListener("lostpointercapture", handlePointerCancel, true);
    document.addEventListener("click", handleClick, true);

    return () => {
      map.off("zoomend", handleZoomEnd);
      map.off("zoomstart", closeOpenTooltip);
      map.off("movestart", closeOpenTooltip);
      map.off("dragstart", closeOpenTooltip);
      container.removeEventListener("pointerdown", handlePointerDown, true);
      container.removeEventListener("pointerup", handlePointerUp, true);
      container.removeEventListener("pointercancel", handlePointerCancel, true);
      container.removeEventListener("lostpointercapture", handlePointerCancel, true);
      document.removeEventListener("click", handleClick, true);
      backgroundPointerRef.current = null;
      backgroundCompatibilityRef.current = null;
      backgroundCancelledAtRef.current = null;
    };
  }, [handlePlainMapInteraction, map]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const currentSelectedId = selectedIdRef.current;
      if (!currentSelectedId) return;
      if (shouldHandleMapSelectionEscape(event)) {
        const keyboardMarkerId = keyboardSelectedMarkerIdRef.current;
        const restoreMarkerId = keyboardMarkerId === currentSelectedId ? currentSelectedId : null;
        onClearSelectionRef.current?.();

        if (!restoreMarkerId) return;

        const restoreFocus = () => {
          escapeFocusFrameRef.current = null;
          const markerElements = map
            .getContainer()
            .querySelectorAll<HTMLElement>(".leaflet-marker-icon");
          focusConnectedMarker(markerElements, restoreMarkerId);
        };

        if (typeof requestAnimationFrame === "function") {
          escapeFocusFrameRef.current = requestAnimationFrame(restoreFocus);
        } else {
          queueMicrotask(restoreFocus);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (escapeFocusFrameRef.current !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(escapeFocusFrameRef.current);
      }
      escapeFocusFrameRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cameraPolicy = getMapCameraPolicy({
      owner: "selection",
      navigationOwnsViewport,
      reducedMotion,
    });

    if (selectedId && selectedId !== prevSelectedId.current) {
      const selected = items.find((m) => m.id === selectedId);
      if (selected && cameraPolicy.shouldMove) {
        previousViewRef.current = getCurrentView();
        const center: [number, number] = [selected.coordinates.lat, selected.coordinates.lng];
        const zoom = Math.max(map.getZoom(), flyZoom);
        if (cameraPolicy.animate) {
          map.flyTo(center, zoom, { duration: 0.6 });
        } else {
          map.setView(center, zoom, { animate: false });
        }
      }
      prevSelectedId.current = selectedId;
    } else if (!selectedId && prevSelectedId.current !== null) {
      const nextView = getViewAfterDeselect(getCurrentView(), previousViewRef.current);
      if (cameraPolicy.shouldMove) {
        const center: [number, number] = [nextView.center.lat, nextView.center.lng];
        if (cameraPolicy.animate) {
          map.flyTo(center, nextView.zoom, { duration: 0.5 });
        } else {
          map.setView(center, nextView.zoom, { animate: false });
        }
      }
      previousViewRef.current = null;
      prevSelectedId.current = null;
    }
  }, [selectedId, items, map, flyZoom, getCurrentView, navigationOwnsViewport]);

  return (
    <MapMarkers
      items={items}
      selectedId={selectedId}
      routeDestinationId={routeDestinationId}
      minimizeNonDestinationMarkers={minimizeNonDestinationMarkers}
      protectedMarkerIds={protectedMarkerIds}
      zoom={zoom}
        onSelect={handleMarkerSelect}
        onMarkerActivate={handleMarkerActivate}
        onMarkerTapOverride={onMarkerTapOverride}
        onDeselect={handleMarkerDeselect}
        onDirections={handleMarkerDirections}
    />
  );
}
