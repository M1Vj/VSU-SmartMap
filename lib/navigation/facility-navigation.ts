import type { Facility } from "@/lib/types/facility";

export function createFacilitySelectionRequest(facility: Facility) {
  return {
    tab: "map" as const,
    options: {
      selectFacilityAfter: facility,
    },
  };
}

export function createFacilityNavigationRequest(facility: Facility) {
  return {
    route: "/" as const,
    facility,
    facilityId: facility.id,
    selectedFacilityId: null,
  };
}

export function shouldConsumeFacilityNavigationRequest(
  facilityId: string,
  lastConsumedFacilityId: string | null
) {
  return facilityId !== lastConsumedFacilityId;
}
