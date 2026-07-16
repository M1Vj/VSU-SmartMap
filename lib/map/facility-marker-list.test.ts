import test from "node:test";
import assert from "node:assert/strict";

import {
  areFacilityMarkerListsEquivalent,
  getVisibleFacilitiesForMapLoad,
} from "./facility-marker-list.ts";
import type { Facility } from "@/lib/types/facility";

const facilities: Facility[] = [
  {
    id: "admin-id",
    name: "Administration Building",
    slug: "administration-building",
    category: "administrative",
    coordinates: { lat: 10.7471, lng: 124.7966 },
    hasRooms: true,
    createdAt: "2026-06-21T00:00:00.000Z",
    updatedAt: "2026-06-21T00:00:00.000Z",
  },
  {
    id: "library-id",
    name: "University Library",
    slug: "university-library",
    category: "library",
    coordinates: { lat: 10.7468, lng: 124.7955 },
    hasRooms: false,
    createdAt: "2026-06-21T00:00:00.000Z",
    updatedAt: "2026-06-21T00:00:00.000Z",
  },
];

test("getVisibleFacilitiesForMapLoad applies active map filters before markers render", () => {
  const visible = getVisibleFacilitiesForMapLoad(facilities, "", ["administrative"]);

  assert.deepEqual(
    visible.map((facility) => facility.id),
    ["admin-id"],
  );
});

test("areFacilityMarkerListsEquivalent ignores non-marker detail changes", () => {
  const updatedDetails = facilities.map((facility) =>
    facility.id === "admin-id"
      ? { ...facility, description: "Updated detail text" }
      : facility,
  );

  assert.equal(areFacilityMarkerListsEquivalent(facilities, updatedDetails), true);
});

test("areFacilityMarkerListsEquivalent detects marker-visible changes", () => {
  const movedFacility = facilities.map((facility) =>
    facility.id === "admin-id"
      ? {
          ...facility,
          coordinates: {
            lat: facility.coordinates.lat + 0.001,
            lng: facility.coordinates.lng,
          },
        }
      : facility,
  );

  assert.equal(areFacilityMarkerListsEquivalent(facilities, movedFacility), false);
});
