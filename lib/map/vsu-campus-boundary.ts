import type { LatLngBoundsExpression } from "leaflet";
import type { MapEdge, MapNode } from "@/lib/types/graph";

type Point = { lat: number; lng: number };

export const VSU_CAMPUS_BOUNDS = [
  { lat: 10.814, lng: 124.749348 },
  { lat: 10.822038081627637, lng: 124.7757491696657 },
  { lat: 10.658947200761956, lng: 124.79274733931466 },
  { lat: 10.668224762427302, lng: 124.86089376097551 },
] as const satisfies readonly Point[];

const VSU_CAMPUS_POLYGON: readonly Point[] = [
  VSU_CAMPUS_BOUNDS[0],
  VSU_CAMPUS_BOUNDS[1],
  VSU_CAMPUS_BOUNDS[3],
  VSU_CAMPUS_BOUNDS[2],
];

const latitudes = VSU_CAMPUS_BOUNDS.map((point) => point.lat);
const longitudes = VSU_CAMPUS_BOUNDS.map((point) => point.lng);

export const VSU_CAMPUS_LEAFLET_BOUNDS: LatLngBoundsExpression = [
  [Math.min(...latitudes), Math.min(...longitudes)],
  [Math.max(...latitudes), Math.max(...longitudes)],
];

export function isPointInsideVsuCampus(point: Point): boolean {
  let inside = false;

  for (let i = 0, j = VSU_CAMPUS_POLYGON.length - 1; i < VSU_CAMPUS_POLYGON.length; j = i++) {
    const current = VSU_CAMPUS_POLYGON[i];
    const previous = VSU_CAMPUS_POLYGON[j];
    if (isPointOnSegment(point, previous, current)) return true;

    const intersects =
      current.lng > point.lng !== previous.lng > point.lng &&
      point.lat <
        ((previous.lat - current.lat) * (point.lng - current.lng)) /
          (previous.lng - current.lng) +
          current.lat;

    if (intersects) inside = !inside;
  }

  return inside;
}

export function clampPointToVsuCampus(point: Point): Point {
  if (isPointInsideVsuCampus(point)) return point;

  let nearest = VSU_CAMPUS_POLYGON[0];
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < VSU_CAMPUS_POLYGON.length; i++) {
    const a = VSU_CAMPUS_POLYGON[i];
    const b = VSU_CAMPUS_POLYGON[(i + 1) % VSU_CAMPUS_POLYGON.length];
    const candidate = nearestPointOnSegment(point, a, b);
    const distance = squaredDistance(point, candidate);

    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export function filterGraphToVsuCampus(nodes: MapNode[], edges: MapEdge[]) {
  const nodesInside = nodes.filter((node) => isPointInsideVsuCampus(node));
  const nodeIds = new Set(nodesInside.map((node) => node.id));
  const edgesInside = edges.filter(
    (edge) => nodeIds.has(edge.source_id) && nodeIds.has(edge.target_id)
  );

  return { nodes: nodesInside, edges: edgesInside };
}

function nearestPointOnSegment(point: Point, a: Point, b: Point): Point {
  const ab = { lat: b.lat - a.lat, lng: b.lng - a.lng };
  const ap = { lat: point.lat - a.lat, lng: point.lng - a.lng };
  const lengthSquared = ab.lat * ab.lat + ab.lng * ab.lng;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, (ap.lat * ab.lat + ap.lng * ab.lng) / lengthSquared));

  return {
    lat: a.lat + ab.lat * t,
    lng: a.lng + ab.lng * t,
  };
}

function squaredDistance(a: Point, b: Point) {
  const lat = a.lat - b.lat;
  const lng = a.lng - b.lng;
  return lat * lat + lng * lng;
}

function isPointOnSegment(point: Point, a: Point, b: Point) {
  const cross =
    (point.lng - a.lng) * (b.lat - a.lat) -
    (point.lat - a.lat) * (b.lng - a.lng);

  if (Math.abs(cross) > 1e-10) return false;

  const withinLat =
    point.lat >= Math.min(a.lat, b.lat) - 1e-10 &&
    point.lat <= Math.max(a.lat, b.lat) + 1e-10;
  const withinLng =
    point.lng >= Math.min(a.lng, b.lng) - 1e-10 &&
    point.lng <= Math.max(a.lng, b.lng) + 1e-10;

  return withinLat && withinLng;
}
