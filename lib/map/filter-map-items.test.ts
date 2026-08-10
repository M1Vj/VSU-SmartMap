import assert from "node:assert/strict";
import test from "node:test";

import { filterMapItems } from "./filter-map-items.ts";
import type { FacilityMapItem } from "@/lib/types/map";

const facilities: FacilityMapItem[] = [
  {
    id: "code",
    name: "Code Hall",
    code: "ABC-123",
    category: "academic",
    coordinates: { lat: 10.7, lng: 124.8 },
  },
  {
    id: "prose",
    name: "Room (Annex)",
    code: "ANNEX",
    category: "academic",
    coordinates: { lat: 10.71, lng: 124.81 },
  },
];

test("normalizes facility code separators in the primary map filter path", () => {
  assert.deepEqual(
    filterMapItems(facilities, "abc 123", ["academic"]).results.map((item) => item.id),
    ["code"],
  );
});

test("keeps punctuation-only map filters as literal name or description matches", () => {
  assert.deepEqual(
    filterMapItems(facilities, "(", ["academic"]).results.map((item) => item.id),
    ["prose"],
  );
});

test("bounds oversized map filter terms", () => {
  const query = "a".repeat(200);
  const item: FacilityMapItem = {
    ...facilities[0],
    id: "long",
    name: "a".repeat(128),
  };

  assert.deepEqual(
    filterMapItems([item], query, ["academic"]).results.map((entry) => entry.id),
    ["long"],
  );
});
