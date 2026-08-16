export const MAP_LEAFLET_ZOOM_OPTIONS = {
  scrollWheelZoom: true,
  doubleClickZoom: true,
  touchZoom: true,
  keyboard: true,
  zoomSnap: 0,
  zoomDelta: 0.25,
  wheelDebounceTime: 16,
  wheelPxPerZoomLevel: 120,
} as const;

export const MAP_ZOOM_ANIMATION_OPTIONS = {
  zoomAnimation: true,
  fadeAnimation: true,
  markerZoomAnimation: true,
} as const;
