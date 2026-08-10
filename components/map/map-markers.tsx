"use client";

import { useMemo } from "react";
import { getMapMarkerRenderItems } from "@/lib/map/marker-clusters";
import type { MapItem } from "@/lib/types/map";
import { MapMarker } from "./map-marker";
import { MapMarkerCluster } from "./map-marker-cluster";

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
  const renderItems = useMemo(
    () => getMapMarkerRenderItems(items, zoomBucket, { protectedIds }),
    [items, protectedIds, zoomBucket],
  );

  return (
    <>
      {renderItems.map((entry) =>
        entry.renderType === "cluster" ? (
          <MapMarkerCluster key={entry.id} cluster={entry} />
        ) : (
          <MapMarker
            key={entry.id}
            item={entry.item}
            displayCoordinates={entry.displayCoordinates}
            onSelect={onSelect}
            onMarkerTapOverride={onMarkerTapOverride}
            onDeselect={onDeselect}
            onDirections={onDirections}
            isSelected={entry.item.id === selectedId}
            isRouteDestination={entry.item.id === routeDestinationId}
            forceMinimized={minimizeNonDestinationMarkers && entry.item.id !== routeDestinationId}
            zoom={zoom}
          />
        ),
      )}
    </>
  );
}
