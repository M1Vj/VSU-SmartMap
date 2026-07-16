import test from "node:test";
import assert from "node:assert/strict";

import {
  compactBoardingHousesForPrompt,
  shouldIncludeBoardingHouseContext,
} from "./boarding-context.ts";
import type { BoardingHouseChatContext } from "@/lib/supabase/queries/boarding-houses.server.ts";

const listing: BoardingHouseChatContext = {
  id: "listing-1",
  slug: "green-gate",
  name: "Green Gate Residence",
  addressLine: "Pangasugan Road",
  priceMin: 2500,
  priceMax: 3200,
  availableSlots: 3,
  roomTypes: ["bedspace"],
  occupancyPolicies: ["female_only"],
  wifi: true,
  cookingAllowed: false,
  furnished: true,
  airConditioning: true,
  laundryArea: false,
  dryingArea: true,
  waterIncluded: true,
  electricityIncluded: false,
  privateBathroom: false,
  advanceMonths: 1,
  depositMonths: 1,
  hasCurfew: true,
  curfewTime: "21:00:00",
  smokingAllowed: false,
  cctv: true,
  walkingMinutesToCampusGate: 7,
};

test("shouldIncludeBoardingHouseContext gates boarding-house retrieval to relevant queries", () => {
  assert.equal(shouldIncludeBoardingHouseContext("Ladies-only boarding houses under ₱3,000?"), true);
  assert.equal(shouldIncludeBoardingHouseContext("Where is the library?"), false);
});

test("compactBoardingHousesForPrompt keeps compact listing data and true flags only", () => {
  const compact = compactBoardingHousesForPrompt([listing]);

  assert.deepEqual(JSON.parse(compact), [
    {
      listingId: "listing-1",
      slug: "green-gate",
      name: "Green Gate Residence",
      priceMin: 2500,
      priceMax: 3200,
      slots: 3,
      walkMinutes: 7,
      flags: [
        "wifi",
        "furnished",
        "airConditioning",
        "dryingArea",
        "waterIncluded",
        "hasCurfew",
        "cctv",
      ],
      occupancy: ["female_only"],
      roomTypes: ["bedspace"],
    },
  ]);
});
