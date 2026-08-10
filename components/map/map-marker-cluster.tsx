"use client";

import { useCallback, useMemo } from "react";
import { divIcon } from "leaflet";
import { Marker, useMap } from "@/components/map/leaflet-react";
import { FAN_OUT_MIN_ZOOM } from "@/lib/map/declutter";
import {
  getMarkerClusterIconSpec,
  isMarkerClusterActivationKey,
} from "@/lib/map/marker-cluster-icon";
import type { MarkerCluster } from "@/lib/map/marker-clusters";
import type { MapItem } from "@/lib/types/map";

type MapMarkerClusterProps = {
  cluster: MarkerCluster<MapItem>;
};

export function MapMarkerCluster({ cluster }: MapMarkerClusterProps) {
  const map = useMap();
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

  const expand = useCallback(() => {
    const currentZoom = map.getZoom();
    const nextZoom = Math.min(
      map.getMaxZoom(),
      Math.max(FAN_OUT_MIN_ZOOM, currentZoom + 2),
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
      icon={icon}
      keyboard
      riseOnHover
      alt={`${iconSpec.label}. Activate to zoom in.`}
      title={`${iconSpec.label}. Activate to zoom in.`}
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
