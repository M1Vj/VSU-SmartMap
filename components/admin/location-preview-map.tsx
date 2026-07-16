"use client";

import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, useMap } from "@/components/map/leaflet-react";
import { useTheme } from "next-themes";
import type { LatLng } from "@/lib/types/common";
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM, MAP_TILES } from "@/lib/constants/map";
import { useMapStyle } from "@/lib/context/map-style-context";
import { VSU_CAMPUS_LEAFLET_BOUNDS } from "@/lib/map/vsu-campus-boundary";
import { MAP_LEAFLET_ZOOM_OPTIONS, MAP_ZOOM_ANIMATION_OPTIONS } from "@/lib/map/wheel-zoom";
import { SmoothWheelZoom, SmoothZoomControl } from "@/components/map/smooth-wheel-zoom";

interface LocationPreviewMapProps {
  coordinates: LatLng;
}

// Opened inside an animating dialog, Leaflet's first size measure can be stale
// and leave grey tiles. Re-measure once shown.
function InvalidateOnReady() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export function LocationPreviewMap({ coordinates }: LocationPreviewMapProps) {
  const { resolvedTheme } = useTheme();
  const { mapStyle } = useMapStyle();

  // Leaflet needs raster XYZ tiles; the vector style URLs render blank here.
  const tiles =
    mapStyle === "satellite"
      ? { url: MAP_TILES.satelliteUrl, attribution: MAP_TILES.satelliteAttribution, maxNativeZoom: MAP_TILES.maxNativeZoom ?? MAP_MAX_ZOOM }
      : resolvedTheme === "dark"
        ? { url: MAP_TILES.rasterDarkUrl, attribution: MAP_TILES.rasterDarkAttribution, maxNativeZoom: 20 }
        : { url: MAP_TILES.rasterStreetUrl, attribution: MAP_TILES.rasterStreetAttribution, maxNativeZoom: 19 };

  return (
    <div className="h-full w-full">
      <MapContainer
        center={[coordinates.lat, coordinates.lng]}
        zoom={17}
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
        <SmoothZoomControl />
        <SmoothWheelZoom />
        <InvalidateOnReady />
        <CircleMarker
          center={[coordinates.lat, coordinates.lng]}
          radius={12}
          pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.6, weight: 3 }}
        />
      </MapContainer>
    </div>
  );
}
