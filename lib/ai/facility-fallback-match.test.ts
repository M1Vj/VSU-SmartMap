import test from "node:test";
import assert from "node:assert/strict";

import { findFallbackFacilityRefs } from "./facility-fallback-match.ts";

test("findFallbackFacilityRefs matches direct location requests by facility code", () => {
  const matches = findFallbackFacilityRefs("Where is Admin Building?", [
    {
      id: "admin-id",
      name: "Administration Building",
      code: "ADMIN",
      category: "administrative",
      description: undefined,
    },
    {
      id: "library-id",
      name: "VSU Library",
      category: "library",
      description: undefined,
    },
  ]);

  assert.deepEqual(matches, [
    {
      facilityId: "admin-id",
      name: "Administration Building",
    },
  ]);
});

test("findFallbackFacilityRefs limits broad category-style matches", () => {
  const matches = findFallbackFacilityRefs("library", [
    {
      id: "library-id",
      name: "VSU Library",
      category: "library",
      description: undefined,
    },
    {
      id: "library-annex-id",
      name: "Library Annex",
      category: "library",
      description: undefined,
    },
  ]);

  assert.equal(matches.length, 2);
  assert.equal(matches[0].facilityId, "library-id");
});
