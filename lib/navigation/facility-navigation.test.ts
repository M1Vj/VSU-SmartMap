import test from "node:test";
import assert from "node:assert/strict";

import {
  createFacilitySelectionRequest,
  createFacilityNavigationRequest,
  shouldConsumeFacilityNavigationRequest,
} from "./facility-navigation.ts";

const facility = {
  id: "admin-id",
  name: "Administration Building",
  slug: "administration-building",
  category: "administrative" as const,
  coordinates: { lat: 10.7471, lng: 124.7966 },
  hasRooms: true as const,
  createdAt: "2026-06-21T00:00:00.000Z",
  updatedAt: "2026-06-21T00:00:00.000Z",
};

test("createFacilityNavigationRequest targets the map and keeps the facility payload", () => {
  assert.deepEqual(createFacilityNavigationRequest(facility), {
    route: "/",
    facility,
    facilityId: "admin-id",
    selectedFacilityId: null,
  });
});

test("shouldConsumeFacilityNavigationRequest ignores duplicate pending requests", () => {
  assert.equal(shouldConsumeFacilityNavigationRequest("admin-id", null), true);
  assert.equal(shouldConsumeFacilityNavigationRequest("admin-id", "admin-id"), false);
  assert.equal(shouldConsumeFacilityNavigationRequest("library-id", "admin-id"), true);
});

test("createFacilitySelectionRequest targets map selection without route navigation", () => {
  assert.deepEqual(createFacilitySelectionRequest(facility), {
    tab: "map",
    options: {
      selectFacilityAfter: facility,
    },
  });
});
