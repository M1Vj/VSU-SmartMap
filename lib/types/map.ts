import type { LatLng } from "./common";
import type { FacilityCategory } from "@/lib/types/facility";
import type { BoardingHouseSummary } from "@/lib/boarding-houses/types";

export type FacilityMapItem = {
  readonly kind?: "facility";
  readonly id: string;
  readonly name: string;
  readonly code?: string;
  readonly description?: string;
  readonly category?: FacilityCategory;
  readonly hasRooms?: boolean;
  readonly coordinates: LatLng;
};

export type BoardingHouseMapItem = {
  readonly kind: "boarding_house";
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly coordinates: LatLng;
  readonly summary: BoardingHouseSummary;
};

export type MapItem = FacilityMapItem | BoardingHouseMapItem;
