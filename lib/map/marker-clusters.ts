import type { LatLng } from "@/lib/types/common";
import {
  FAN_OUT_MIN_ZOOM,
  getCentroid,
  getPixelsAsDegrees,
  groupItemsByDistance,
  OVERLAP_THRESHOLD_PIXELS,
  spreadCoLocatedItems,
  type DeclutterableItem,
} from "./declutter";

/** The first zoom where the existing fan-out guard separates co-located pins. */
export const MIN_CLUSTER_EXPANSION_ZOOM = 19;

export type MarkerCluster<T extends DeclutterableItem> = {
  readonly renderType: "cluster";
  readonly id: string;
  readonly items: readonly T[];
  readonly coordinates: LatLng;
};

export type MarkerRenderItem<T extends DeclutterableItem> =
  | {
      readonly renderType: "marker";
      readonly id: string;
      readonly item: T;
      readonly displayCoordinates: LatLng;
    }
  | MarkerCluster<T>;

export type MarkerRenderOptions = {
  /** Items that must stay individually interactive at overview zoom. */
  readonly protectedIds?: ReadonlySet<string>;
};

/**
 * Chooses the map layers to render for the current zoom. Overview zooms use
 * one accessible cluster marker for each nearby group; campus/detail zooms
 * keep the existing individual-marker and co-located fan-out behavior.
 */
export function getMapMarkerRenderItems<T extends DeclutterableItem>(
  items: readonly T[],
  zoom: number,
  options: MarkerRenderOptions = {},
): MarkerRenderItem<T>[] {
  const zoomBucket = Math.floor(zoom);

  if (zoomBucket >= FAN_OUT_MIN_ZOOM) {
    return spreadCoLocatedItems(items, zoomBucket).map(({ item, displayCoordinates }) => ({
      renderType: "marker",
      id: item.id,
      item,
      displayCoordinates,
    }));
  }

  const latitude = averageLatitude(items);
  const tolerance = getPixelsAsDegrees(
    OVERLAP_THRESHOLD_PIXELS,
    latitude,
    Math.max(0, zoomBucket),
  );

  const protectedIds = options.protectedIds ?? EMPTY_PROTECTED_IDS;

  return groupItemsByDistance(items, tolerance).flatMap((group) => {
    const members = group.map(({ item }) => item);
    const protectedMembers = members.filter((item) => protectedIds.has(item.id));
    const clusterMembers = members.filter((item) => !protectedIds.has(item.id));
    const protectedMarkers = protectedMembers.map(createMarkerRenderItem);

    if (clusterMembers.length <= 1) {
      return [
        ...protectedMarkers,
        ...clusterMembers.map(createMarkerRenderItem),
      ];
    }

    return [
      ...protectedMarkers,
      createClusterRenderItem(clusterMembers),
    ];
  });
}

function createMarkerRenderItem<T extends DeclutterableItem>(item: T): MarkerRenderItem<T> {
  return {
    renderType: "marker",
    id: item.id,
    item,
    displayCoordinates: item.coordinates,
  };
}

function createClusterRenderItem<T extends DeclutterableItem>(
  items: readonly T[],
): MarkerCluster<T> {
  const orderedIds = items.map((item) => item.id).sort();
  return {
    renderType: "cluster",
    id: `cluster:${orderedIds.join("|")}`,
    items,
    coordinates: getCentroid(items.map((item) => item.coordinates)),
  };
}

function averageLatitude(items: readonly DeclutterableItem[]): number {
  if (items.length === 0) return 0;
  return items.reduce((sum, item) => sum + item.coordinates.lat, 0) / items.length;
}

const EMPTY_PROTECTED_IDS: ReadonlySet<string> = new Set();
