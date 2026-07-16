import { filterMapItems } from "@/lib/map/filter-map-items";
import type { Facility, FacilityCategory } from "@/lib/types/facility";

function markerKey(facility: Facility) {
  return [
    facility.id,
    facility.code ?? "",
    facility.name,
    facility.category,
    facility.coordinates.lat,
    facility.coordinates.lng,
    facility.hasRooms,
  ].join("|");
}

export function areFacilityMarkerListsEquivalent(
  current: readonly Facility[],
  next: readonly Facility[],
) {
  if (current.length !== next.length) return false;

  const currentKeys = new Map(current.map((facility) => [facility.id, markerKey(facility)]));

  return next.every((facility) => currentKeys.get(facility.id) === markerKey(facility));
}

export function getVisibleFacilitiesForMapLoad(
  facilities: readonly Facility[],
  term: string,
  selectedCategories: readonly FacilityCategory[],
) {
  return filterMapItems(
    facilities,
    term,
    [...selectedCategories],
    new Set<string>(),
  ).results as Facility[];
}
