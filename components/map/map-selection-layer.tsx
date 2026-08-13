"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMap } from "@/components/map/leaflet-react";
import type { LeafletMouseEvent } from "leaflet";
import { getViewAfterDeselect, type MapViewState } from "@/lib/map/selection-view";
import { getMapCameraPolicy } from "@/lib/navigation/map-camera-policy";
import type { MapItem } from "@/lib/types/map";
import { MapMarkers } from "./map-markers";
import { recordMapPerformance } from "@/lib/map/performance";

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
  const zoomStartedAtRef = useRef<number | null>(null);
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

    const handleZoomEnd = () => {
      setZoom(map.getZoom());
      const startedAt = zoomStartedAtRef.current;
      zoomStartedAtRef.current = null;
      if (startedAt !== null && minimizeNonDestinationMarkers && typeof performance !== "undefined") {
        recordMapPerformance("route_zoom_continuity", Math.max(0, performance.now() - startedAt));
      }
    };

    const handleZoomStart = () => {
      zoomStartedAtRef.current = typeof performance !== "undefined" ? performance.now() : null;
      closeOpenTooltip();
    };

    const handleMapClick = (event: LeafletMouseEvent) => {
      const target = event.originalEvent?.target as HTMLElement | null;
      handlePlainMapInteraction(
        target,
        onMapClick ? { lat: event.latlng.lat, lng: event.latlng.lng } : undefined,
      );
    };

    map.on("click", handleMapClick);
    map.on("zoomend", handleZoomEnd);
    map.on("zoomstart", handleZoomStart);
    map.on("movestart", closeOpenTooltip);
    map.on("dragstart", closeOpenTooltip);

    return () => {
      map.off("click", handleMapClick);
      map.off("zoomend", handleZoomEnd);
      map.off("zoomstart", handleZoomStart);
      map.off("movestart", closeOpenTooltip);
      map.off("dragstart", closeOpenTooltip);
    };
  }, [handlePlainMapInteraction, map, minimizeNonDestinationMarkers, onMapClick]);

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
