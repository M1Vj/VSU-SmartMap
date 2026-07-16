"use client";

import { LocationPickerMap } from "@/components/map/location-picker-map";

type LatLng = { lat: number; lng: number };

type ReferenceDistancePickerProps = {
  reference: LatLng;
  onReferenceChange: (point: LatLng) => void;
  listings?: Array<{ id: string; lat: number; lng: number }>;
};

export default function ReferenceDistancePicker({
  reference,
  onReferenceChange,
  listings = [],
}: ReferenceDistancePickerProps) {
  return (
    <LocationPickerMap
      value={reference}
      onChange={onReferenceChange}
      markers={listings}
      className="h-72 w-full rounded-xl border"
    />
  );
}
