import test from "node:test";
import assert from "node:assert/strict";

import { unifiedFacilitySchema } from "./facility.ts";

const baseFacility = {
  code: "TEST",
  name: "Test Facility",
  description: "",
  category: "academic" as const,
  hasRooms: true,
  imageUrl: "",
  imageCredit: "",
  website: "",
  facebook: "",
  phone: "",
};

test("unifiedFacilitySchema accepts facility coordinates inside VSU", () => {
  const result = unifiedFacilitySchema.safeParse({
    ...baseFacility,
    coordinates: { lat: 10.7445, lng: 124.79194 },
  });

  assert.equal(result.success, true);
});

test("unifiedFacilitySchema rejects facility coordinates outside VSU", () => {
  const result = unifiedFacilitySchema.safeParse({
    ...baseFacility,
    coordinates: { lat: 10.9, lng: 124.9 },
  });

  assert.equal(result.success, false);
  assert.match(result.error?.issues[0]?.message ?? "", /inside the VSU campus/i);
});
