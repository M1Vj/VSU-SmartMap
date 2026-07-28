"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMap } from "@/components/map/leaflet-react";
import { getViewAfterDeselect, type MapViewState } from "@/lib/map/selection-view";
import { getMapCameraPolicy } from "@/lib/navigation/map-camera-policy";
import type { MapItem } from "@/lib/types/map";
import { MapMarkers } from "./map-markers";

const TAP_MOVE_TOLERANCE_PX = 12;
const TAP_MAX_DURATION_MS = 350;
const MAP_INTERACTIVE_SELECTOR = [
  ".leaflet-control",
  ".leaflet-marker-icon",
  ".leaflet-popup",
  ".leaflet-tooltip",
  ".leaflet-interactive",
].join(",");

type MapSelectionLayerProps = {
  items: readonly MapItem[];
  selectedId: string | null;
  routeDestinationId?: string | null;
  minimizeNonDestinationMarkers?: boolean;
  onSelect: (item: MapItem) => void;
  onMarkerTapOverride?: (item: MapItem) => void;
  onDirections?: (item: MapItem) => void;
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
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const mouseStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [zoom, setZoom] = useState(() => map.getZoom());

  const getCurrentView = useCallback(() => ({
    center: {
      lat: map.getCenter().lat,
      lng: map.getCenter().lng,
    },
    zoom: map.getZoom(),
  }), [map]);

  const handlePlainMapInteraction = useCallback((target: HTMLElement | null, point?: { lat: number; lng: number }) => {
    if (!target) {
      return;
    }

    if (target.closest(MAP_INTERACTIVE_SELECTOR)) {
      return;
    }

    if (point && onMapClick) {
      onMapClick(point);
      return;
    }

    onClearSelection?.();
  }, [onClearSelection, onMapClick]);

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

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || !container.contains(target)) {
        mouseStartRef.current = null;
        return;
      }

      mouseStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        time: Date.now(),
      };
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && !container.contains(target)) {
        return;
      }

      const start = mouseStartRef.current;
      mouseStartRef.current = null;
      if (start) {
        const movedX = Math.abs(event.clientX - start.x);
        const movedY = Math.abs(event.clientY - start.y);
        const duration = Date.now() - start.time;

        if (
          movedX > TAP_MOVE_TOLERANCE_PX ||
          movedY > TAP_MOVE_TOLERANCE_PX ||
          duration > TAP_MAX_DURATION_MS
        ) {
          return;
        }
      }

      const latlng = onMapClick ? map.mouseEventToLatLng(event) : null;

      handlePlainMapInteraction(
        target,
        latlng ? { lat: latlng.lat, lng: latlng.lng } : undefined,
      );
    };

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) {
        touchStartRef.current = null;
        return;
      }

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;

      if (!start) {
        return;
      }

      const touch = event.changedTouches[0];
      if (!touch) {
        return;
      }

      const movedX = Math.abs(touch.clientX - start.x);
      const movedY = Math.abs(touch.clientY - start.y);
      const duration = Date.now() - start.time;

      if (
        movedX > TAP_MOVE_TOLERANCE_PX ||
        movedY > TAP_MOVE_TOLERANCE_PX ||
        duration > TAP_MAX_DURATION_MS
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      if (onMapClick) {
        const latlng = map.mouseEventToLatLng(touch as unknown as MouseEvent);
        handlePlainMapInteraction(target, { lat: latlng.lat, lng: latlng.lng });
        return;
      }

      handlePlainMapInteraction(target);
    };

    map.on("zoomend", handleZoomEnd);
    map.on("zoomstart", closeOpenTooltip);
    map.on("movestart", closeOpenTooltip);
    map.on("dragstart", closeOpenTooltip);
    container.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("click", handleClick, true);
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      map.off("zoomend", handleZoomEnd);
      map.off("zoomstart", closeOpenTooltip);
      map.off("movestart", closeOpenTooltip);
      map.off("dragstart", closeOpenTooltip);
      container.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("click", handleClick, true);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handlePlainMapInteraction, map, onMapClick]);

  useEffect(() => {
    if (!selectedId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClearSelection?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClearSelection, selectedId]);

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
      zoom={zoom}
      onSelect={onSelect}
      onMarkerTapOverride={onMarkerTapOverride}
      onDeselect={onClearSelection}
      onDirections={onDirections}
    />
  );
}
