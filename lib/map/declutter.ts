import type { LatLng } from "@/lib/types/common";

const FAN_OUT_MIN_ZOOM = 16;
const OVERLAP_THRESHOLD_PIXELS = 34;
// Fan-out regime only: never group pins farther apart than one building
// footprint — a larger pixel-derived tolerance chains unrelated buildings
// into one ring far from their true locations. Below FAN_OUT_MIN_ZOOM the
// group collapses to its centroid dot instead of a ring, so the honest
// screen-space tolerance applies there and nearby dots keep merging.
const MAX_GROUP_DISTANCE_METERS = 12;
// A fan-out ring is a deliberate lie about position; keep it below one
// building's footprint. At lower zooms the same pixel radius spans tens of
// meters, so grouped pins stay at their true spots and separate after the
// click-to-zoom flyTo instead.
const MAX_VISUAL_DISPLACEMENT_METERS = 16;
const PIN_SPACING_PIXELS = 30;
const BASE_RADIUS_PIXELS = 24;
const EARTH_METERS_PER_DEGREE = 111_320;
const EQUATOR_METERS_PER_PIXEL = 156_543.03392;

type DeclutterableItem = {
  readonly id: string;
  readonly coordinates: LatLng;
};

type IndexedItem<T extends DeclutterableItem> = {
  readonly item: T;
  readonly index: number;
};

export type SpreadCoLocatedItem<T extends DeclutterableItem> = {
  readonly item: T;
  readonly trueCoordinates: LatLng;
  readonly displayCoordinates: LatLng;
};

/**
 * Display-only radial fan-out for markers that OVERLAP ON SCREEN at the given
 * zoom bucket. Grouping distance is derived from pixels (pin width), not fixed
 * meters, so buildings a few meters apart — which stack completely at campus
 * zoom levels — separate too. True coordinates are preserved for routing,
 * deep links, and flyTo.
 */
export function spreadCoLocatedItems<T extends DeclutterableItem>(
  items: readonly T[],
  zoom: number,
): SpreadCoLocatedItem<T>[] {
  const output = items.map((item) => ({
    item,
    trueCoordinates: item.coordinates,
    displayCoordinates: item.coordinates,
  }));

  const zoomBucket = Math.floor(zoom);
  const lat = averageLatitude(items);
  const overlapDegrees = getPixelsAsDegrees(
    OVERLAP_THRESHOLD_PIXELS,
    lat,
    Math.max(FAN_OUT_MIN_ZOOM, zoomBucket),
  );
  const buildingDegrees = getMetersAsDegrees(MAX_GROUP_DISTANCE_METERS, lat);
  const toleranceDegrees =
    zoomBucket < FAN_OUT_MIN_ZOOM
      ? overlapDegrees
      : {
          lat: Math.min(overlapDegrees.lat, buildingDegrees.lat),
          lng: Math.min(overlapDegrees.lng, buildingDegrees.lng),
        };
  const groups = groupOverlappingItems(items, toleranceDegrees);

  for (const group of groups) {
    if (group.length < 2) {
      continue;
    }

    const centroid = getCentroid(group.map(({ item }) => item.coordinates));

    if (zoomBucket < FAN_OUT_MIN_ZOOM) {
      for (const member of group) {
        output[member.index] = {
          ...output[member.index],
          displayCoordinates: centroid,
        };
      }
      continue;
    }

    const orderedGroup = [...group].sort((a, b) => a.item.id.localeCompare(b.item.id));
    const radiusPixels = Math.max(
      Math.min(42, BASE_RADIUS_PIXELS + (zoomBucket - FAN_OUT_MIN_ZOOM) * 6),
      (orderedGroup.length * PIN_SPACING_PIXELS) / (2 * Math.PI),
    );
    if (getPixelsAsMeters(radiusPixels, centroid.lat, zoomBucket) > MAX_VISUAL_DISPLACEMENT_METERS) {
      continue;
    }
    const radius = getPixelsAsDegrees(radiusPixels, centroid.lat, zoomBucket);

    orderedGroup.forEach((member, position) => {
      const angle = -Math.PI / 2 + (position / orderedGroup.length) * Math.PI * 2;
      output[member.index] = {
        ...output[member.index],
        displayCoordinates: {
          lat: centroid.lat + Math.sin(angle) * radius.lat,
          lng: centroid.lng + Math.cos(angle) * radius.lng,
        },
      };
    });
  }

  return output;
}

function groupOverlappingItems<T extends DeclutterableItem>(
  items: readonly T[],
  tolerance: LatLng,
): IndexedItem<T>[][] {
  const indexed = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.id.localeCompare(b.item.id));
  const groups: IndexedItem<T>[][] = [];

  for (const candidate of indexed) {
    const group = groups.find((existing) =>
      existing.some(({ item }) =>
        areCoordinatesNear(candidate.item.coordinates, item.coordinates, tolerance),
      ),
    );

    if (group) {
      group.push(candidate);
    } else {
      groups.push([candidate]);
    }
  }

  return groups;
}

function areCoordinatesNear(a: LatLng, b: LatLng, tolerance: LatLng) {
  return (
    Math.abs(a.lat - b.lat) <= tolerance.lat &&
    Math.abs(a.lng - b.lng) <= tolerance.lng
  );
}

function getCentroid(coordinates: readonly LatLng[]): LatLng {
  const total = coordinates.reduce(
    (sum, coordinate) => ({
      lat: sum.lat + coordinate.lat,
      lng: sum.lng + coordinate.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: total.lat / coordinates.length,
    lng: total.lng / coordinates.length,
  };
}

function averageLatitude(items: readonly DeclutterableItem[]): number {
  if (items.length === 0) return 0;
  return items.reduce((sum, item) => sum + item.coordinates.lat, 0) / items.length;
}

function getPixelsAsMeters(pixels: number, lat: number, zoomBucket: number): number {
  const latitudeScale = Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  return pixels * ((EQUATOR_METERS_PER_PIXEL * latitudeScale) / 2 ** zoomBucket);
}

function getMetersAsDegrees(meters: number, lat: number): LatLng {
  const latitudeScale = Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  return {
    lat: meters / EARTH_METERS_PER_DEGREE,
    lng: meters / (EARTH_METERS_PER_DEGREE * latitudeScale),
  };
}

function getPixelsAsDegrees(pixels: number, lat: number, zoomBucket: number): LatLng {
  const latitudeScale = Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  const metersPerPixel = (EQUATOR_METERS_PER_PIXEL * latitudeScale) / 2 ** zoomBucket;
  const meters = pixels * metersPerPixel;

  return {
    lat: meters / EARTH_METERS_PER_DEGREE,
    lng: meters / (EARTH_METERS_PER_DEGREE * latitudeScale),
  };
}
