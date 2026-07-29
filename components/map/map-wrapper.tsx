import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "@maplibre/maplibre-gl-leaflet";

import L from "leaflet";
import { MapContainer, TileLayer, useMap } from "@/components/map/leaflet-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, MAP_MIN_ZOOM, MAP_MAX_ZOOM, MAP_TILES } from "@/lib/constants/map";
import { useApp } from "@/lib/context/app-context";
import { MAP_LEAFLET_ZOOM_OPTIONS, MAP_ZOOM_ANIMATION_OPTIONS } from "@/lib/map/wheel-zoom";
import { SmoothWheelZoom, SmoothZoomControl } from "@/components/map/smooth-wheel-zoom";
import { VSU_CAMPUS_LEAFLET_BOUNDS } from "@/lib/map/vsu-campus-boundary";
import type { LatLngBoundsExpression } from "leaflet";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { getMapCameraPolicy } from "@/lib/navigation/map-camera-policy";

const DEVELOPER_ATTRIBUTION =
  '<a href="https://github.com/M1Vj" target="_blank" rel="noopener noreferrer">Developed by Vj F Mabansag</a>';

type MapWrapperProps = {
  children?: React.ReactNode;
  className?: string;
  bounds?: LatLngBoundsExpression | null;
};

// Component to handle bounds changes
function DeveloperAttribution() {
  const map = useMap();

  useEffect(() => {
    map.attributionControl.addAttribution(DEVELOPER_ATTRIBUTION);

    return () => {
      map.attributionControl.removeAttribution(DEVELOPER_ATTRIBUTION);
    };
  }, [map]);

  return null;
}

function MapBoundsHandler({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (bounds) {
      const policy = getMapCameraPolicy({
        owner: "route",
        navigationOwnsViewport: true,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
      map.fitBounds(bounds, {
        padding: [36, 36],
        maxZoom: 18,
        animate: policy.animate,
      });
    }
  }, [bounds, map]);

  return null;
}

function OpenFreeMapVectorLayer({ styleUrl }: { styleUrl: string }) {
  const map = useMap();

  useEffect(() => {
    const layer = L.maplibreGL({
      style: styleUrl as StyleSpecification | string,
      pitch: MAP_TILES.pitch,
      bearing: MAP_TILES.bearing,
    });

    layer.addTo(map);
    const mapLibreMap = layer.getMaplibreMap();
    const customizeVectorLayer = () => {
      hideNonPlaceTextLabels(mapLibreMap);
      add3dBuildingsLayer(mapLibreMap);
    };

    if (mapLibreMap.isStyleLoaded()) {
      customizeVectorLayer();
    } else {
      mapLibreMap.once("load", customizeVectorLayer);
    }

    return () => {
      mapLibreMap.off("load", customizeVectorLayer);
      layer.remove();
    };
  }, [map, styleUrl]);

  return null;
}

// Campus pins/tooltips are the labels on campus, so basemap POI and street
// text stays hidden — but place names (barangays, towns) stay visible so
// off-campus areas like boarding-house neighborhoods remain identifiable.
function hideNonPlaceTextLabels(mapLibreMap: MapLibreMap) {
  mapLibreMap.getStyle().layers?.forEach((layer) => {
    if (layer.type !== "symbol") return;

    const layout = layer.layout as { "text-field"?: unknown } | undefined;
    if (!layout?.["text-field"]) return;

    const sourceLayer = (layer as { "source-layer"?: string })["source-layer"];
    if (sourceLayer === "place") return;

    mapLibreMap.setLayoutProperty(layer.id, "visibility", "none");
  });
}

function add3dBuildingsLayer(mapLibreMap: MapLibreMap) {
  if (!mapLibreMap.getSource("openmaptiles")) return;
  if (mapLibreMap.getLayer("building-3d") || mapLibreMap.getLayer("vsu-3d-buildings")) return;

  const beforeId = mapLibreMap
    .getStyle()
    .layers?.find((layer) => layer.type === "symbol")?.id;

  mapLibreMap.addLayer(
    {
      id: "vsu-3d-buildings",
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 15,
      paint: {
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-color": "hsl(35, 8%, 82%)",
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
        "fill-extrusion-opacity": 0.72,
      },
    },
    beforeId
  );
}

export function MapWrapper({ children, className, bounds }: MapWrapperProps) {
  const { resolvedTheme } = useTheme();
  const { mapStyle } = useApp();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mapStyleUrl = (() => {
    if (!mounted) return MAP_TILES.url;
    if (mapStyle === "satellite") return MAP_TILES.satelliteUrl;
    return resolvedTheme === "dark" && MAP_TILES.darkUrl ? MAP_TILES.darkUrl : MAP_TILES.url;
  })();

  return (
    <div className="map-wrapper h-full w-full relative">
      <style>{`
        @media (max-width: 768px) {
          .map-wrapper .leaflet-bottom.leaflet-left {
            margin-bottom: 5rem;
          }
        }
      `}</style>
      <MapContainer
        center={[MAP_DEFAULT_CENTER.lat, MAP_DEFAULT_CENTER.lng]}
        zoom={MAP_DEFAULT_ZOOM}
        minZoom={MAP_MIN_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        zoomControl={false}
        {...MAP_LEAFLET_ZOOM_OPTIONS}
        {...MAP_ZOOM_ANIMATION_OPTIONS}
        bounceAtZoomLimits={false}
        maxBounds={VSU_CAMPUS_LEAFLET_BOUNDS}
        maxBoundsViscosity={1}
        className={className ?? "h-full w-full"}
      >
        {mapStyle === "satellite" ? (
          <>
            <TileLayer
              key={mapStyleUrl}
              attribution={MAP_TILES.satelliteAttribution}
              url={mapStyleUrl}
              maxZoom={MAP_MAX_ZOOM}
              maxNativeZoom={MAP_TILES.maxNativeZoom ?? MAP_MAX_ZOOM}
            />
            <TileLayer
              url={MAP_TILES.satelliteTransportUrl}
              maxZoom={MAP_MAX_ZOOM}
              maxNativeZoom={MAP_TILES.maxNativeZoom ?? MAP_MAX_ZOOM}
            />
            <TileLayer
              url={MAP_TILES.satelliteLabelsUrl}
              maxZoom={MAP_MAX_ZOOM}
              maxNativeZoom={MAP_TILES.maxNativeZoom ?? MAP_MAX_ZOOM}
            />
          </>
        ) : (
          <OpenFreeMapVectorLayer key={mapStyleUrl} styleUrl={mapStyleUrl} />
        )}
        <DeveloperAttribution />
        <SmoothZoomControl position="bottomleft" />
        <SmoothWheelZoom />
        <MapBoundsHandler bounds={bounds ?? null} />
        {children}
      </MapContainer>
    </div>
  );
}
