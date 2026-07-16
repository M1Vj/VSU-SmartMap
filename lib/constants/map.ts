import type { LatLng } from "@/lib/types";

export const MAP_DEFAULT_CENTER: LatLng = { lat: 10.74450, lng: 124.79194 }; // Approx VSU campus;
// VSU Upper Main Gate (facility 29b2dff9-01d7-49b7-9343-04e5c5d37ef1) — the
// real main entrance; default "campus gate" reference for boarding-house
// walking times and the route quick-start.
export const VSU_MAIN_GATE: LatLng = { lat: 10.7445449580544, lng: 124.792301058769 };
export const MAP_DEFAULT_ZOOM = 16;
export const MAP_MIN_ZOOM = 14;
export const MAP_MAX_ZOOM = 20;

export const MAP_TILES = {
  url: "https://tiles.openfreemap.org/styles/liberty",
  darkUrl: "https://tiles.openfreemap.org/styles/dark",
  satelliteUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  // Reference overlays stacked on satellite imagery so off-campus places stay
  // identifiable (place names + road names); plain imagery has no labels.
  satelliteLabelsUrl:
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  satelliteTransportUrl:
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
  // Raster (XYZ) fallbacks for plain Leaflet TileLayer surfaces (location
  // pickers). The `url`/`darkUrl` above are MapLibre vector STYLE documents and
  // only render in the MapLibre GL main map — they appear blank in Leaflet.
  rasterStreetUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  rasterDarkUrl: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution:
    '© <a href="https://openfreemap.org">OpenFreeMap</a> · Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  satelliteAttribution:
    'Tiles © <a href="https://www.esri.com/">Esri</a>',
  rasterStreetAttribution:
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  rasterDarkAttribution:
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
  maxNativeZoom: 18,
  pitch: 0,
  bearing: 0,
};
