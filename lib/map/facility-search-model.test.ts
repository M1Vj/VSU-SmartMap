import assert from "node:assert/strict";
import test from "node:test";

import { buildFacilitySearchOptions } from "./facility-search-model.ts";

test("maps ranked suggestions to one shared display model", () => {
  const options = buildFacilitySearchOptions({
    facilities: [{
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
    }],
    rooms: [{
      facility_id: "11111111-1111-4111-8111-111111111111",
      room_code: "DSTAT-201",
      name: "Statistics Lab",
    }],
    query: "201",
  });

  assert.deepEqual(options.map(({ id, primary, secondary, matchedRoomCode }) => ({
    id,
    primary,
    secondary,
    matchedRoomCode,
  })), [{
    id: "11111111-1111-4111-8111-111111111111",
    primary: "Department of Statistics",
    secondary: "DSTAT · Academic · Room DSTAT-201",
    matchedRoomCode: "DSTAT-201",
  }]);
});

test("returns no options for a blank query and caps results at eight", () => {
  assert.deepEqual(buildFacilitySearchOptions({
    facilities: [],
    rooms: [],
    query: " ",
  }), []);
});
