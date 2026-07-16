"use client";

import { LocationPickerMap } from "@/components/map/location-picker-map";

type LatLng = { lat: number; lng: number };

type ListingLocationPickerProps = {
  location: LatLng | null;
  onChange: (point: LatLng) => void;
};

export default function ListingLocationPicker({
  location,
  onChange,
}: ListingLocationPickerProps) {
  return (
    <LocationPickerMap
      value={location}
      onChange={onChange}
      className="h-64 w-full rounded-xl border"
    />
  );
}
