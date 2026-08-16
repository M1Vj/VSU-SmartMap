import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "@maplibre/maplibre-gl-leaflet";

import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  ZoomControl,
  useMap,
} from "@/components/map/leaflet-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, MAP_MIN_ZOOM, MAP_MAX_ZOOM, MAP_TILES } from "@/lib/constants/map";
import { useApp } from "@/lib/context/app-context";
import { MAP_LEAFLET_ZOOM_OPTIONS, MAP_ZOOM_ANIMATION_OPTIONS } from "@/lib/map/wheel-zoom";
import { createMapViewportSyncScheduler } from "@/lib/map/map-viewport-sync";
import { VSU_CAMPUS_LEAFLET_BOUNDS } from "@/lib/map/vsu-campus-boundary";
import { createTileFallbackState, recordTileError } from "@/lib/map/tile-fallback";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

const DEVELOPER_ATTRIBUTION =
  '<a href="https://github.com/M1Vj" target="_blank" rel="noopener noreferrer">Developed by Vj F Mabansag</a>';

type MapWrapperProps = {
  children?: React.ReactNode;
  className?: string;
};

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

function OpenFreeMapVectorLayer({
  styleUrl,
  mapLibreMapRef,
}: {
  styleUrl: string;
  mapLibreMapRef: MutableRefObject<MapLibreMap | null>;
}) {
  const map = useMap();

  useEffect(() => {
    const layerOptions = {
      style: styleUrl as StyleSpecification | string,
      pitch: MAP_TILES.pitch,
      bearing: MAP_TILES.bearing,
      // Keep the visual mirror close to the browser frame rate while Leaflet
      // remains the sole owner of map gestures.
      updateInterval: 16,
    } as Parameters<typeof L.maplibreGL>[0] & { updateInterval: number };
    const layer = L.maplibreGL(layerOptions);

    layer.addTo(map);
    const mapLibreMap = layer.getMaplibreMap();
    mapLibreMapRef.current = mapLibreMap;
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
      if (mapLibreMapRef.current === mapLibreMap) mapLibreMapRef.current = null;
      layer.remove();
    };
  }, [map, mapLibreMapRef, styleUrl]);

  return null;
}

// Campus pins/tooltips are the labels on campus, so basemap POI and street
// text stays hidden — but place names (barangays, towns) stay visible so
// off-campus areas like boarding-house neighborhoods remain identifiable.
function MapViewportSync({
  mapLibreMapRef,
}: {
  mapLibreMapRef: MutableRefObject<MapLibreMap | null>;
}) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const requestFrame = (callback: () => void) =>
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(callback)
        : window.setTimeout(callback, 0);
    const cancelFrame = (frameId: number) => {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frameId);
      else window.clearTimeout(frameId);
    };
    const viewportSync = createMapViewportSyncScheduler({
      requestFrame,
      cancelFrame,
      invalidateSize: () => map.invalidateSize({ pan: false, debounceMoveend: true }),
      resize: () => mapLibreMapRef.current?.resize(),
      repaint: () => mapLibreMapRef.current?.triggerRepaint(),
    });
    const handleWindowResize = () => viewportSync.schedule(true);
    const handleMapResize = () => viewportSync.schedule();
    const handleMapMove = () => viewportSync.schedule();
    const handleZoomAnimation = () => viewportSync.schedule();
    const handleZoomEnd = () => viewportSync.schedule();
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => viewportSync.schedule(true));

    resizeObserver?.observe(container);
    if (!resizeObserver) window.addEventListener("resize", handleWindowResize);
    map.on("resize", handleMapResize);
    map.on("move", handleMapMove);
    map.on("zoomanim", handleZoomAnimation);
    map.on("zoomend", handleZoomEnd);

    return () => {
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", handleWindowResize);
      map.off("resize", handleMapResize);
      map.off("move", handleMapMove);
      map.off("zoomanim", handleZoomAnimation);
      map.off("zoomend", handleZoomEnd);
      viewportSync.dispose();
    };
  }, [map, mapLibreMapRef]);

  return null;
}

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

export function MapWrapper({ children, className }: MapWrapperProps) {
  const { resolvedTheme } = useTheme();
  const { mapStyle } = useApp();
  const [mounted, setMounted] = useState(false);
  const [satelliteFallbackActive, setSatelliteFallbackActive] = useState(false);
  const satelliteTileFallbackState = useRef(createTileFallbackState());
  const mapLibreMapRef = useRef<MapLibreMap | null>(null);

  const handleSatelliteTileError = useCallback(() => {
    const nextState = recordTileError(satelliteTileFallbackState.current);
    satelliteTileFallbackState.current = nextState;
    if (nextState.active) setSatelliteFallbackActive(true);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mapStyle === "satellite") return;
    satelliteTileFallbackState.current = createTileFallbackState();
    setSatelliteFallbackActive(false);
  }, [mapStyle]);

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
            margin-bottom: calc(5rem + env(safe-area-inset-bottom));
          }

          .map-wrapper .leaflet-bottom.leaflet-right {
            margin-bottom: calc(var(--student-mobile-nav-height) + env(safe-area-inset-bottom, 0px));
          }

          .map-wrapper .leaflet-control-attribution {
            font-size: 0.625rem;
            line-height: 1.2;
            padding: 0 0.25rem;
          }

          .map-wrapper .leaflet-control-zoom a {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            min-width: 44px;
            height: 44px;
            min-height: 44px;
            line-height: 44px;
          }
        }

        @media (pointer: coarse), (any-pointer: coarse) {
          .map-wrapper .leaflet-control-zoom a {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            min-width: 44px;
            height: 44px;
            min-height: 44px;
            line-height: 44px;
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
          satelliteFallbackActive ? (
            <TileLayer
              key="satellite-raster-fallback"
              attribution={MAP_TILES.satelliteFallbackAttribution}
              url={MAP_TILES.satelliteFallbackUrl}
              crossOrigin="anonymous"
              maxZoom={MAP_MAX_ZOOM}
              maxNativeZoom={MAP_TILES.maxNativeZoom ?? MAP_MAX_ZOOM}
              updateWhenIdle={false}
            />
          ) : (
            <>
              <TileLayer
                key={MAP_TILES.satelliteUrl}
                attribution={MAP_TILES.satelliteAttribution}
                url={MAP_TILES.satelliteUrl}
                crossOrigin="anonymous"
                maxZoom={MAP_MAX_ZOOM}
                maxNativeZoom={MAP_TILES.maxNativeZoom ?? MAP_MAX_ZOOM}
                updateWhenIdle={false}
                eventHandlers={{ tileerror: handleSatelliteTileError }}
              />
              <TileLayer
                url={MAP_TILES.satelliteTransportUrl}
                crossOrigin="anonymous"
                maxZoom={MAP_MAX_ZOOM}
                maxNativeZoom={MAP_TILES.maxNativeZoom ?? MAP_MAX_ZOOM}
                updateWhenIdle={false}
              />
              <TileLayer
                url={MAP_TILES.satelliteLabelsUrl}
                crossOrigin="anonymous"
                maxZoom={MAP_MAX_ZOOM}
                maxNativeZoom={MAP_TILES.maxNativeZoom ?? MAP_MAX_ZOOM}
                updateWhenIdle={false}
              />
            </>
          )
        ) : (
          <OpenFreeMapVectorLayer
            key={mapStyleUrl}
            styleUrl={mapStyleUrl}
            mapLibreMapRef={mapLibreMapRef}
          />
        )}
        <MapViewportSync mapLibreMapRef={mapLibreMapRef} />
        <DeveloperAttribution />
        <ZoomControl position="bottomleft" />
        {children}
      </MapContainer>
      {satelliteFallbackActive && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-32 z-[1000] -translate-x-1/2 rounded-full border bg-background/95 px-3 py-1.5 text-center text-xs font-medium text-foreground shadow-md"
        >
          Satellite imagery unavailable; showing a map fallback.
        </div>
      )}
    </div>
  );
}
