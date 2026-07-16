"use client";

import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "@/components/map/leaflet-react";
import { toast } from "sonner";

import type { LatLng } from "@/lib/types/common";
import { MAP_DEFAULT_CENTER, MAP_MAX_ZOOM, MAP_MIN_ZOOM, MAP_TILES } from "@/lib/constants/map";
import { useMapStyle } from "@/lib/context/map-style-context";
import {
  VSU_CAMPUS_LEAFLET_BOUNDS,
  isPointInsideVsuCampus,
} from "@/lib/map/vsu-campus-boundary";
import { MAP_LEAFLET_ZOOM_OPTIONS, MAP_ZOOM_ANIMATION_OPTIONS } from "@/lib/map/wheel-zoom";
import { SmoothWheelZoom, SmoothZoomControl } from "@/components/map/smooth-wheel-zoom";
import { cn } from "@/lib/utils";

type MarkerPoint = { id: string; lat: number; lng: number };

interface LocationPickerMapProps {
  value: LatLng | null;
  onChange: (coords: LatLng) => void;
  /** Reject pin clicks outside the VSU campus polygon. The viewport is always
   * clamped to the campus bounds regardless of this flag. */
  restrictToCampus?: boolean;
  /** Secondary reference dots (e.g. boarding houses) shown for context. */
  markers?: readonly MarkerPoint[];
  zoom?: number;
  /** Height/border utility classes for the wrapper. */
  className?: string;
}

function ClickCapture({
  onChange,
  restrictToCampus,
}: {
  onChange: (coords: LatLng) => void;
  restrictToCampus: boolean;
}) {
  useMapEvents({
    click(event) {
      const point = { lat: event.latlng.lat, lng: event.latlng.lng };
      if (restrictToCampus && !isPointInsideVsuCampus(point)) {
        toast.error("Place the pin inside the VSU campus map.");
        return;
      }
      onChange(point);
    },
  });
  return null;
}

function MapCenterUpdater({ value }: { value: LatLng | null }) {
  const map = useMap();
  const lat = value?.lat;
  const lng = value?.lng;
  useEffect(() => {
    if (lat != null && lng != null) map.setView([lat, lng]);
  }, [map, lat, lng]);
  return null;
}

// Leaflet measures its container on mount; inside a dialog that animates in the
// first measure can be stale and leave grey tiles. Re-measure once shown.
function InvalidateOnReady() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

/**
 * Shared location picker map — single source of truth for the "select location"
 * experience (admin facility coordinate picker, owner listing location, and the
 * student walking-time reference). Theme/style-aware tiles, smooth zoom, and a
 * click-to-place blue marker. Set `restrictToCampus` for on-campus-only pins.
 */
export function LocationPickerMap({
  value,
  onChange,
  restrictToCampus = false,
  markers = [],
  zoom = 17,
  className = "h-full w-full",
}: LocationPickerMapProps) {
  const { resolvedTheme } = useTheme();
  const { mapStyle } = useMapStyle();

  // Leaflet needs raster XYZ tiles; the vector style URLs render blank here.
  const tiles =
    mapStyle === "satellite"
      ? { url: MAP_TILES.satelliteUrl, attribution: MAP_TILES.satelliteAttribution, maxNativeZoom: MAP_TILES.maxNativeZoom ?? MAP_MAX_ZOOM }
      : resolvedTheme === "dark"
        ? { url: MAP_TILES.rasterDarkUrl, attribution: MAP_TILES.rasterDarkAttribution, maxNativeZoom: 20 }
        : { url: MAP_TILES.rasterStreetUrl, attribution: MAP_TILES.rasterStreetAttribution, maxNativeZoom: 19 };

  const center = value ?? MAP_DEFAULT_CENTER;

  return (
    <div className={cn("location-picker", className)}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        minZoom={MAP_MIN_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        className="h-full w-full"
        zoomControl={false}
        {...MAP_LEAFLET_ZOOM_OPTIONS}
        {...MAP_ZOOM_ANIMATION_OPTIONS}
        bounceAtZoomLimits={false}
        maxBounds={VSU_CAMPUS_LEAFLET_BOUNDS}
        maxBoundsViscosity={1}
      >
        <TileLayer
          key={tiles.url}
          attribution={tiles.attribution}
          url={tiles.url}
          maxZoom={MAP_MAX_ZOOM}
          maxNativeZoom={tiles.maxNativeZoom}
        />
        {mapStyle === "satellite" && (
          <>
            <TileLayer
              url={MAP_TILES.satelliteTransportUrl}
              maxZoom={MAP_MAX_ZOOM}
              maxNativeZoom={tiles.maxNativeZoom}
            />
            <TileLayer
              url={MAP_TILES.satelliteLabelsUrl}
              maxZoom={MAP_MAX_ZOOM}
              maxNativeZoom={tiles.maxNativeZoom}
            />
          </>
        )}
        <SmoothZoomControl position="bottomleft" />
        <SmoothWheelZoom />
        <InvalidateOnReady />
        <MapCenterUpdater value={value} />
        <ClickCapture onChange={onChange} restrictToCampus={restrictToCampus} />
        {markers.map((marker) => (
          <CircleMarker
            key={marker.id}
            center={[marker.lat, marker.lng]}
            radius={5}
            pathOptions={{
              color: "#fff",
              weight: 2,
              fillColor: "#059669",
              fillOpacity: 0.95,
            }}
          />
        ))}
        {value && (
          <CircleMarker
            center={[value.lat, value.lng]}
            radius={10}
            pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.5 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
