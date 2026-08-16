"use client";

import { memo } from "react";
import type { MapItem } from "@/lib/types/map";
import { MapMarker } from "./map-marker";

type MapMarkersProps = {
  items: readonly MapItem[];
  selectedId?: string | null;
  routeDestinationId?: string | null;
  minimizeNonDestinationMarkers?: boolean;
  zoom: number;
  onSelect?: (item: MapItem) => void;
  onMarkerTapOverride?: (item: MapItem) => void;
  onMarkerActivate?: (item: MapItem, activationId: string, modality: "mouse" | "touch" | "pen" | "keyboard") => void;
  onDeselect?: () => void;
  onDirections?: (item: MapItem) => number | null;
};

export const MapMarkers = memo(function MapMarkers({
  items,
  selectedId,
  routeDestinationId,
  minimizeNonDestinationMarkers = false,
  zoom,
  onSelect,
  onMarkerTapOverride,
  onMarkerActivate,
  onDeselect,
  onDirections,
}: MapMarkersProps) {
  return (
    <>
      {items.map((item) => (
        <MapMarker
          key={item.id}
          item={item}
          onSelect={onSelect}
          onMarkerTapOverride={onMarkerTapOverride}
          onMarkerActivate={onMarkerActivate}
          onDeselect={onDeselect}
          onDirections={onDirections}
          isSelected={item.id === selectedId}
          isRouteDestination={item.id === routeDestinationId}
          forceMinimized={minimizeNonDestinationMarkers && item.id !== routeDestinationId}
          zoom={zoom}
        />
      ))}
    </>
  );
});
