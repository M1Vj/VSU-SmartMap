import test from "node:test";
import assert from "node:assert/strict";

import { toBoardingHouseSummary } from "./boarding-houses.ts";

test("toBoardingHouseSummary maps a public listing row into UI-ready summary fields", () => {
  const summary = toBoardingHouseSummary({
    id: "bh-1",
    slug: "green-gate-residence",
    name: "Green Gate Residence",
    status: "published",
    verification_status: "verified",
    address_line: "Pangasugan Road",
    latitude: 10.7445,
    longitude: 124.7921,
    thumbnail_url: null,
    price_min: 2500,
    price_max: 3500,
    price_changed_at: "2026-06-10T00:00:00.000Z",
    available_slots: 4,
    room_types: ["bedspace", "shared_room"],
    occupancy_policies: ["female_only"],
    wifi: true,
    cooking_allowed: true,
    furnished: true,
    air_conditioning: false,
    laundry_area: true,
    parking: false,
    study_area: true,
    has_curfew: false,
    curfew_time: null,
    allows_visitors: true,
    allows_pets: false,
    walking_minutes_to_campus_gate: 8,
    owner_display_name: "Verified Owner",
    avg_rating: 4.5,
    rating_count: 12,
    published_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-15T00:00:00.000Z",
  });

  assert.equal(summary.id, "bh-1");
  assert.deepEqual(summary.coordinates, { lat: 10.7445, lng: 124.7921 });
  assert.equal(summary.rules.hasCurfew, false);
  assert.deepEqual(summary.roomTypes, ["bedspace", "shared_room"]);
  assert.equal(summary.averageRating, 4.5);
  assert.equal(summary.reviewCount, 12);
  assert.equal(summary.waterIncluded, false);
  assert.equal(summary.electricityIncluded, false);
  assert.equal(summary.privateBathroom, false);
  assert.equal(summary.advanceMonths, null);
  assert.equal(summary.depositMonths, null);
  assert.equal(summary.amenities.dryingArea, false);
  assert.equal(summary.rules.smokingAllowed, false);
  assert.deepEqual(summary.safetyFeatures, []);
  assert.equal(summary.applianceFee, null);
  assert.deepEqual(summary.mobileCarriers, []);
});

test("toBoardingHouseSummary maps utility inclusions and move-in terms when present", () => {
  const summary = toBoardingHouseSummary({
    id: "bh-2",
    slug: "green-gate-residence",
    name: "Green Gate Residence",
    status: "published",
    verification_status: "verified",
    address_line: "Pangasugan Road",
    latitude: 10.7445,
    longitude: 124.7921,
    thumbnail_url: null,
    price_min: 2500,
    price_max: 3500,
    price_changed_at: null,
    available_slots: 4,
    room_types: ["bedspace"],
    occupancy_policies: ["female_only"],
    wifi: true,
    cooking_allowed: true,
    furnished: true,
    air_conditioning: false,
    laundry_area: true,
    parking: false,
    study_area: true,
    has_curfew: false,
    curfew_time: null,
    allows_visitors: true,
    allows_pets: false,
    walking_minutes_to_campus_gate: 8,
    owner_display_name: "Verified Owner",
    avg_rating: 4.5,
    rating_count: 12,
    water_included: true,
    electricity_included: true,
    private_bathroom: true,
    advance_months: 1,
    deposit_months: 2,
    drying_area: true,
    smoking_allowed: true,
    safety_features: ["cctv", "fire_extinguisher"],
    appliance_fee: 150,
    mobile_carriers: ["smart", "globe"],
    published_at: null,
    updated_at: "2026-07-04T00:00:00.000Z",
  });

  assert.equal(summary.waterIncluded, true);
  assert.equal(summary.electricityIncluded, true);
  assert.equal(summary.privateBathroom, true);
  assert.equal(summary.advanceMonths, 1);
  assert.equal(summary.depositMonths, 2);
  assert.equal(summary.amenities.dryingArea, true);
  assert.equal(summary.rules.smokingAllowed, true);
  assert.deepEqual(summary.safetyFeatures, ["cctv", "fire_extinguisher"]);
  assert.equal(summary.applianceFee, 150);
  assert.deepEqual(summary.mobileCarriers, ["smart", "globe"]);
});
