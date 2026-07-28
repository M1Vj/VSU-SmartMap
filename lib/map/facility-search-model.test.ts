import assert from "node:assert/strict";
import test from "node:test";

import { buildFacilitySearchOptions } from "./facility-search-model.ts";
import type { Facility } from "@/lib/types/facility";

test("maps ranked suggestions to one shared display model", () => {
  const facility: Facility = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Department of Statistics",
    code: "DSTAT",
    category: "academic",
    description: "Statistics building",
    slug: "department-of-statistics",
    coordinates: { lat: 10.7, lng: 124.8 },
    hasRooms: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const options = buildFacilitySearchOptions({
    facilities: [facility],
    rooms: [{
      facility_id: "11111111-1111-4111-8111-111111111111",
      room_code: "DSTAT-201",
      name: "Statistics Lab",
    }],
    query: "201",
  });

  assert.deepEqual(options, [{
    id: "11111111-1111-4111-8111-111111111111",
    facility,
    primary: "Department of Statistics",
    secondary: "DSTAT · Academic · Room DSTAT-201",
    color: "#10b981",
    matchedRoomCode: "DSTAT-201",
  }]);
});

test("returns no options for a blank query", () => {
  assert.deepEqual(buildFacilitySearchOptions({
    facilities: [],
    rooms: [],
    query: " ",
  }), []);
});

test("preserves ranking order, defaults to eight results, and forwards a custom limit", () => {
  const facilities: Facility[] = Array.from({ length: 10 }, (_, index) => ({
    id: `academic-${index}`,
    name: `Academic Building ${index}`,
    code: `ACAD${index}`,
    category: "academic",
    slug: `academic-building-${index}`,
    coordinates: { lat: 10.7, lng: 124.8 },
    hasRooms: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }));

  const defaultOptions = buildFacilitySearchOptions({
    facilities,
    rooms: [],
    query: "academic",
  });
  const limitedOptions = buildFacilitySearchOptions({
    facilities,
    rooms: [],
    query: "academic",
    limit: 3,
  });

  assert.deepEqual(
    defaultOptions.map((option) => option.id),
    facilities.slice(0, 8).map((facility) => facility.id),
  );
  assert.deepEqual(
    limitedOptions.map((option) => option.id),
    facilities.slice(0, 3).map((facility) => facility.id),
  );
});
