"use client";

import { useMemo } from "react";
import { Marker, Tooltip } from "@/components/map/leaflet-react";
import { divIcon, type LeafletEvent, type Marker as LeafletMarker } from "leaflet";

type ManualStartPinProps = {
  point: {
    lat: number;
    lng: number;
  };
  onChange?: (point: { lat: number; lng: number }) => void;
};

export function ManualStartPin({ point, onChange }: ManualStartPinProps) {
  const icon = useMemo(
    () =>
      divIcon({
        className: "manual-start-pin",
        html: '<div class="h-5 w-5 rounded-full border-2 border-blue-700 bg-blue-500/80 shadow-lg ring-4 ring-blue-500/20"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    [],
  );

  return (
    <Marker
      position={[point.lat, point.lng]}
      icon={icon}
      draggable
      eventHandlers={{
        dragend: (event: LeafletEvent) => {
          const marker = event.target as LeafletMarker;
          const next = marker.getLatLng();
          onChange?.({ lat: next.lat, lng: next.lng });
        },
      }}
      title="Starting pin"
      alt="Starting pin"
    >
      <Tooltip direction="top" offset={[0, -10]} opacity={1}>
        Starting pin
      </Tooltip>
    </Marker>
  );
}
