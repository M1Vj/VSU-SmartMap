"use client";

import { useMemo } from "react";
import { spreadCoLocatedItems } from "@/lib/map/declutter";
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
  onDeselect?: () => void;
  onDirections?: (item: MapItem) => void;
};

export function MapMarkers({
  items,
  selectedId,
  routeDestinationId,
  minimizeNonDestinationMarkers = false,
  zoom,
  onSelect,
  onMarkerTapOverride,
  onDeselect,
  onDirections,
}: MapMarkersProps) {
  const zoomBucket = Math.min(20, Math.max(15, Math.floor(zoom)));
  const protectedIds = useMemo(() => {
    const ids = new Set<string>();
    if (minimizeNonDestinationMarkers || onMarkerTapOverride) {
      items.forEach((item) => ids.add(item.id));
      return ids;
    }
    if (selectedId != null) ids.add(selectedId);
    if (routeDestinationId != null) ids.add(routeDestinationId);
    return ids;
  }, [items, minimizeNonDestinationMarkers, onMarkerTapOverride, routeDestinationId, selectedId]);
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
}
