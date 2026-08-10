"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { divIcon, type Marker as LeafletMarker } from "leaflet";
import { Marker, useMap } from "@/components/map/leaflet-react";
import {
  getMarkerClusterIconSpec,
  isMarkerClusterActivationKey,
} from "@/lib/map/marker-cluster-icon";
import {
  MIN_CLUSTER_EXPANSION_ZOOM,
  type MarkerCluster,
} from "@/lib/map/marker-clusters";
import type { MapItem } from "@/lib/types/map";

type MapMarkerClusterProps = {
  cluster: MarkerCluster<MapItem>;
};

export function MapMarkerCluster({ cluster }: MapMarkerClusterProps) {
  const map = useMap();
  const markerRef = useRef<LeafletMarker | null>(null);
  const iconSpec = useMemo(() => getMarkerClusterIconSpec(cluster.items.length), [cluster.items.length]);
  const icon = useMemo(
    () => divIcon({
      html: iconSpec.html,
      className: "vsu-marker-cluster-icon",
      iconSize: [iconSpec.size, iconSpec.size],
      iconAnchor: [iconSpec.size / 2, iconSpec.size / 2],
    }),
    [iconSpec],
  );
  const accessibleLabel = `${iconSpec.label}. Activate to zoom in.`;
  const setMarkerRef = useCallback((marker: LeafletMarker | null) => {
    markerRef.current = marker;
    setMarkerAccessibility(marker, accessibleLabel);
  }, [accessibleLabel]);

  useEffect(() => {
    setMarkerAccessibility(markerRef.current, accessibleLabel);
  }, [accessibleLabel]);

  const expand = useCallback(() => {
    const currentZoom = map.getZoom();
    const nextZoom = Math.min(
      map.getMaxZoom(),
      Math.max(MIN_CLUSTER_EXPANSION_ZOOM, currentZoom + 2),
    );
    const center: [number, number] = [cluster.coordinates.lat, cluster.coordinates.lng];

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      map.setView(center, nextZoom, { animate: false });
    } else {
      map.flyTo(center, nextZoom, { duration: 0.45 });
    }
  }, [cluster.coordinates, map]);

  return (
    <Marker
      position={[cluster.coordinates.lat, cluster.coordinates.lng]}
      ref={setMarkerRef}
      icon={icon}
      keyboard
      riseOnHover
      alt={accessibleLabel}
      title={accessibleLabel}
      eventHandlers={{
        click: expand,
        keydown: (event) => {
          const original = (event as { originalEvent?: KeyboardEvent }).originalEvent;
          if (!original || !isMarkerClusterActivationKey(original.key)) {
            return;
          }
          original.preventDefault();
          expand();
        },
      }}
    />
  );
}

function setMarkerAccessibility(marker: LeafletMarker | null, label: string) {
  const element = marker?.getElement();
  if (!element) return;

  element.setAttribute("role", "button");
  element.setAttribute("aria-label", label);
}
