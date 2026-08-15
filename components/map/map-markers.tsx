"use client";

import { memo, useMemo } from "react";
import { spreadCoLocatedItems } from "@/lib/map/declutter";
import type { MapItem } from "@/lib/types/map";
import { MapMarker } from "./map-marker";

type MapMarkersProps = {
  items: readonly MapItem[];
  selectedId?: string | null;
  routeDestinationId?: string | null;
  minimizeNonDestinationMarkers?: boolean;
  protectedMarkerIds?: ReadonlySet<string>;
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
  protectedMarkerIds,
  zoom,
  onSelect,
  onMarkerTapOverride,
  onMarkerActivate,
  onDeselect,
  onDirections,
}: MapMarkersProps) {
  const zoomBucket = Math.min(20, Math.max(15, Math.floor(zoom)));
  const protectedIds = useMemo(() => {
    const ids = new Set<string>(protectedMarkerIds ?? []);
    if (minimizeNonDestinationMarkers || onMarkerTapOverride) {
      items.forEach((item) => ids.add(item.id));
      return ids;
    }
    if (selectedId != null) ids.add(selectedId);
    if (routeDestinationId != null) ids.add(routeDestinationId);
    return ids;
  }, [items, minimizeNonDestinationMarkers, onMarkerTapOverride, protectedMarkerIds, routeDestinationId, selectedId]);
  const spreadItems = useMemo(
    () => spreadCoLocatedItems(items, zoomBucket, { protectedIds }),
    [items, protectedIds, zoomBucket],
  );

  return (
    <>
      {spreadItems.map(({ item, displayCoordinates }) => (
        <MapMarker
          key={item.id}
          item={item}
          displayCoordinates={displayCoordinates}
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
