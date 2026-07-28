export type FacilitySearchFailures = {
  facilityFailed: boolean;
  roomFailed: boolean;
};

const SAFE_LOAD_ERROR = "Search suggestions could not be refreshed.";

export function updateFacilitySearchFailures(
  current: FacilitySearchFailures,
  update: Partial<FacilitySearchFailures>,
): FacilitySearchFailures {
  return { ...current, ...update };
}

export function getFacilitySearchLoadError(
  failures: FacilitySearchFailures,
): string | null {
  return failures.facilityFailed || failures.roomFailed
    ? SAFE_LOAD_ERROR
    : null;
}
