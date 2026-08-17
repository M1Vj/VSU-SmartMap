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

export function clampZoomTarget(
  zoom: number,
  minZoom: number,
  maxZoom: number,
): number {
  if (!Number.isFinite(zoom)) return minZoom;
  return Math.min(maxZoom, Math.max(minZoom, zoom));
}

export function nextZoomTarget(
  currentZoom: number,
  delta: number,
  minZoom: number,
  maxZoom: number,
): number {
  return clampZoomTarget(currentZoom + delta, minZoom, maxZoom);
}

export function handleZoomControlKey(
  event: {
    key: string;
    preventDefault: () => void;
    stopPropagation: () => void;
  },
  disabled: boolean,
  activate: () => void,
): boolean {
  if (event.key !== " " && event.key !== "Spacebar") return false;
  event.preventDefault();
  event.stopPropagation();
  if (disabled) return true;
  activate();
  return true;
}
