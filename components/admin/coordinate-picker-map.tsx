"use client";

import type { LatLng } from "@/lib/types/common";
import { LocationPickerMap } from "@/components/map/location-picker-map";

interface CoordinatePickerMapProps {
  value: LatLng;
  onChange: (coords: LatLng) => void;
}

export function CoordinatePickerMap({ value, onChange }: CoordinatePickerMapProps) {
  return <LocationPickerMap value={value} onChange={onChange} restrictToCampus />;
}
