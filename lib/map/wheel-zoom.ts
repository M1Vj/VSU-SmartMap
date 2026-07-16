export const MAP_LEAFLET_ZOOM_OPTIONS = {
  scrollWheelZoom: false,
  zoomSnap: 0,
  zoomDelta: 0.25,
} as const;

export const MAP_SMOOTH_WHEEL_ZOOM_OPTIONS = {
  enabled: true,
  easing: 0.32,
  minZoomDelta: 0.001,
  sensitivity: 0.0048,
  settleDelayMs: 140,
} as const;

export const MAP_SMOOTH_CONTROL_ZOOM_OPTIONS = {
  enabled: true,
  zoomDelta: MAP_LEAFLET_ZOOM_OPTIONS.zoomDelta,
} as const;

export const MAP_ZOOM_ANIMATION_OPTIONS = {
  zoomAnimation: true,
  fadeAnimation: true,
  markerZoomAnimation: true,
} as const;
