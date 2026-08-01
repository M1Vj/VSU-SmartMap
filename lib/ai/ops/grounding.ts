import type { LocationResponse } from "../schemas/location";

export const LOCATION_RESPONSE_TEXT_MAX_LENGTH = 4_000;

export type GroundingOutcome = "pass" | "warn" | "fail";

export type GroundingReasonCode =
  | "RESPONSE_TEXT_EMPTY"
  | "RESPONSE_TEXT_TRUNCATED"
  | "FACILITY_REFERENCE_INVALID"
  | "FACILITY_LIMIT_EXCEEDED"
  | "EVENT_REFERENCE_INVALID"
  | "BOARDING_HOUSE_REFERENCE_INVALID";

export interface GroundingContext {
  facilities: readonly { id: string; name: string }[];
  events: readonly {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    locationText?: string;
    category: string;
  }[];
  boardingHouses: readonly { id: string; name: string }[];
}

export interface GroundingValidationResult {
  response: LocationResponse;
  outcome: GroundingOutcome;
  reasonCodes: GroundingReasonCode[];
}

const FAILURE_REASONS = new Set<GroundingReasonCode>([
  "FACILITY_REFERENCE_INVALID",
  "FACILITY_LIMIT_EXCEEDED",
  "EVENT_REFERENCE_INVALID",
  "BOARDING_HOUSE_REFERENCE_INVALID",
]);

function addReason(reasons: GroundingReasonCode[], reason: GroundingReasonCode) {
  if (!reasons.includes(reason)) reasons.push(reason);
}

export function validateGroundedLocationResponse(
  modelResponse: LocationResponse,
  context: GroundingContext,
): GroundingValidationResult {
  const reasonCodes: GroundingReasonCode[] = [];
  const trimmedText = modelResponse.response.trim();
  const responseText = trimmedText.slice(0, LOCATION_RESPONSE_TEXT_MAX_LENGTH);

  if (trimmedText.length === 0) addReason(reasonCodes, "RESPONSE_TEXT_EMPTY");
  if (trimmedText.length > LOCATION_RESPONSE_TEXT_MAX_LENGTH) {
    addReason(reasonCodes, "RESPONSE_TEXT_TRUNCATED");
  }

  const canonicalFacilities = new Map(context.facilities.map((item) => [item.id, item]));
  const facilities: LocationResponse["facilities"] = [];
  const seenFacilityIds = new Set<string>();
  for (const reference of modelResponse.facilities) {
    const canonical = canonicalFacilities.get(reference.facilityId);
    if (!canonical || canonical.name !== reference.name) {
      addReason(reasonCodes, "FACILITY_REFERENCE_INVALID");
      continue;
    }
    if (!seenFacilityIds.has(reference.facilityId)) {
      seenFacilityIds.add(reference.facilityId);
      facilities.push(reference);
    }
  }
  if (facilities.length > 6) addReason(reasonCodes, "FACILITY_LIMIT_EXCEEDED");

  const canonicalEvents = new Map(context.events.map((item) => [item.id, item]));
  const events: NonNullable<LocationResponse["events"]> = [];
  const seenEventIds = new Set<string>();
  for (const reference of modelResponse.events ?? []) {
    const canonical = canonicalEvents.get(reference.eventId);
    if (
      !canonical ||
      canonical.title !== reference.title ||
      canonical.startTime !== reference.startTime ||
      canonical.endTime !== reference.endTime ||
      canonical.locationText !== reference.locationText ||
      canonical.category !== reference.category
    ) {
      addReason(reasonCodes, "EVENT_REFERENCE_INVALID");
      continue;
    }
    if (!seenEventIds.has(reference.eventId)) {
      seenEventIds.add(reference.eventId);
      events.push(reference);
    }
  }

  const canonicalListings = new Map(context.boardingHouses.map((item) => [item.id, item]));
  const boardingHouses: NonNullable<LocationResponse["boardingHouses"]> = [];
  const seenListingIds = new Set<string>();
  for (const reference of modelResponse.boardingHouses ?? []) {
    const canonical = canonicalListings.get(reference.listingId);
    if (!canonical || canonical.name !== reference.name) {
      addReason(reasonCodes, "BOARDING_HOUSE_REFERENCE_INVALID");
      continue;
    }
    if (!seenListingIds.has(reference.listingId)) {
      seenListingIds.add(reference.listingId);
      boardingHouses.push(reference);
    }
  }

  const sanitizedResponse: LocationResponse = {
    response: responseText,
    facilities: facilities.slice(0, 6),
    ...(modelResponse.events === undefined ? {} : { events }),
    ...(modelResponse.boardingHouses === undefined ? {} : { boardingHouses }),
  };
  const outcome = reasonCodes.some((reason) => FAILURE_REASONS.has(reason))
    ? "fail"
    : reasonCodes.length > 0
      ? "warn"
      : "pass";

  return { response: sanitizedResponse, outcome, reasonCodes };
}
