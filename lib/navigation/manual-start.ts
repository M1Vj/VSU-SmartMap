import { clampPointToVsuCampus } from "@/lib/map/vsu-campus-boundary";

export type NavigationPoint = {
  lat: number;
  lng: number;
};

type PositionLike = {
  coords: {
    latitude: number;
    longitude: number;
  };
};

export type NavigationStartDecision =
  | {
      mode: "live";
      start: NavigationPoint;
    }
  | {
      mode: "manual";
      start: null;
    };

export function resolveNavigationStart(position: PositionLike | null | undefined): NavigationStartDecision {
  if (!position) {
    return {
      mode: "manual",
      start: null,
    };
  }

  const start = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };

  return {
    mode: "live",
    start: clampPointToVsuCampus(start),
  };
}

export function createManualStartPoint(point: NavigationPoint): NavigationPoint {
  return {
    lat: point.lat,
    lng: point.lng,
  };
}
