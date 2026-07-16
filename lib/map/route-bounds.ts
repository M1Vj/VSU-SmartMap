import type { LatLngBoundsExpression } from "leaflet";

type RoutePoint = {
  lat: number;
  lng: number;
};

export function getRouteBounds(path: readonly RoutePoint[]): LatLngBoundsExpression | null {
  if (path.length === 0) return null;

  let minLat = path[0].lat;
  let maxLat = path[0].lat;
  let minLng = path[0].lng;
  let maxLng = path[0].lng;

  for (const point of path.slice(1)) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}
