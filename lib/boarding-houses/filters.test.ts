import test from "node:test";
import assert from "node:assert/strict";

import {
  BOARDING_HOUSE_DEFAULT_FILTERS,
  filterBoardingHouses,
  formatBoardingHousePriceRange,
  sortBoardingHouseResults,
  toBoardingHouseMapEntity,
} from "./filters.ts";
import type { BoardingHouseSummary } from "./types.ts";

const listings: BoardingHouseSummary[] = [
  {
    id: "bh-1",
    slug: "green-gate-residence",
    name: "Green Gate Residence",
    status: "published",
    verificationStatus: "verified",
    addressLine: "Pangasugan Road",
    coordinates: { lat: 10.7445, lng: 124.7921 },
    thumbnailUrl: "/images/boarding/green.jpg",
    coverPhotoBucket: null,
    coverPhotoPath: null,
    priceMin: 2500,
    priceMax: 3500,
    priceChangedAt: "2026-06-10T00:00:00.000Z",
    availableSlots: 4,
    roomTypes: ["bedspace", "shared_room"],
    occupancyPolicies: ["female_only"],
    amenities: {
      wifi: true,
      cookingAllowed: true,
      furnished: true,
      airConditioning: false,
      laundryArea: true,
      dryingArea: true,
      parking: false,
      studyArea: true,
    },
    rules: {
      hasCurfew: false,
      curfewTime: null,
      allowsVisitors: true,
      allowsPets: false,
      smokingAllowed: false,
    },
    walkingMinutesToCampusGate: 8,
    ownerDisplayName:"Verified Owner",
    averageRating: 4.5,
    reviewCount: 12,
    waterIncluded: true,
    electricityIncluded: true,
    safetyFeatures: ["cctv", "fire_extinguisher"],
    applianceFee: 150,
    mobileCarriers: ["smart", "globe"],
    publishedAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-15T00:00:00.000Z",
  },
  {
    id: "bh-2",
    slug: "ridge-rooms",
    name: "Ridge Rooms",
    status: "published",
    verificationStatus: "verified",
    addressLine: "Baybay City",
    coordinates: { lat: 10.752, lng: 124.801 },
    thumbnailUrl: null,
    coverPhotoBucket: null,
    coverPhotoPath: null,
    priceMin: 4200,
    priceMax: 6200,
    priceChangedAt: "2026-06-11T00:00:00.000Z",
    availableSlots: 0,
    roomTypes: ["private_room"],
    occupancyPolicies: ["any_gender"],
    amenities: {
      wifi: true,
      cookingAllowed: false,
      furnished: false,
      airConditioning: true,
      laundryArea: false,
      dryingArea: false,
      parking: true,
      studyArea: false,
    },
    rules: {
      hasCurfew: true,
      curfewTime: "22:00",
      allowsVisitors: false,
      allowsPets: false,
      smokingAllowed: true,
    },
    walkingMinutesToCampusGate: 18,
    ownerDisplayName:"Ridge Owner",
    averageRating: 0,
    reviewCount: 0,
    safetyFeatures: [],
    applianceFee: null,
    mobileCarriers: [],
    publishedAt: "2026-06-02T00:00:00.000Z",
    updatedAt: "2026-06-13T00:00:00.000Z",
  },
];

test("boarding-house map toggle defaults off for first-time users", () => {
  assert.equal(BOARDING_HOUSE_DEFAULT_FILTERS.showOnMap, false);
});

test("filterBoardingHouses applies student-essential filters together", () => {
  const filtered = filterBoardingHouses(listings, {
    ...BOARDING_HOUSE_DEFAULT_FILTERS,
    maxMonthlyPrice: 3500,
    minAvailableSlots: 1,
    roomTypes: ["bedspace"],
    occupancyPolicies: ["female_only"],
    waterIncluded: true,
    wifi: true,
    cookingAllowed: true,
    furnished: true,
    allowsNoCurfew: true,
  });

  assert.deepEqual(
    filtered.map((listing) => listing.id),
    ["bh-1"],
  );
});

test("aircon filter keeps only listings with air conditioning", () => {
  const filtered = filterBoardingHouses(listings, {
    ...BOARDING_HOUSE_DEFAULT_FILTERS,
    airConditioning: true,
  });

  assert.deepEqual(
    filtered.map((listing) => listing.id),
    ["bh-2"],
  );
});

test("granular water/electricity filters keep listings with both inclusions", () => {
  const filtered = filterBoardingHouses(listings, {
    ...BOARDING_HOUSE_DEFAULT_FILTERS,
    waterIncluded: true,
    electricityIncluded: true,
  });

  assert.deepEqual(
    filtered.map((listing) => listing.id),
    ["bh-1"],
  );
});

test("private-bathroom filter matches only explicit inclusions", () => {
  const withExtras: BoardingHouseSummary = {
    ...listings[1],
    id: "bh-4",
    slug: "extras",
    privateBathroom: true,
  };

  const bathroomOnly = filterBoardingHouses([...listings, withExtras], {
    ...BOARDING_HOUSE_DEFAULT_FILTERS,
    privateBathroom: true,
  });
  assert.deepEqual(
    bathroomOnly.map((listing) => listing.id),
    ["bh-4"],
  );
});

test("formatBoardingHousePriceRange keeps Philippine monthly rent clear", () => {
  assert.equal(formatBoardingHousePriceRange(listings[0]), "₱2,500–₱3,500 / month");
});

test("toBoardingHouseMapEntity creates a separate discriminated map entity", () => {
  const entity = toBoardingHouseMapEntity(listings[0]);

  assert.equal(entity.kind, "boarding_house");
  assert.equal(entity.id, "bh-1");
  assert.deepEqual(entity.coordinates, { lat: 10.7445, lng: 124.7921 });
});

const unpricedListing: BoardingHouseSummary = {
  ...listings[0],
  id: "bh-3",
  slug: "unlisted-rate-house",
  name: "Unlisted Rate House",
  priceMin: null,
  priceMax: null,
  availableSlots: 2,
};

test("null-price listing passes a max-price filter (may still be affordable)", () => {
  const filtered = filterBoardingHouses([unpricedListing], {
    ...BOARDING_HOUSE_DEFAULT_FILTERS,
    maxMonthlyPrice: 3000,
  });

  assert.deepEqual(
    filtered.map((listing) => listing.id),
    ["bh-3"],
  );
});

test("null-price listing fails a min-price filter (floor cannot be confirmed)", () => {
  const filtered = filterBoardingHouses([unpricedListing], {
    ...BOARDING_HOUSE_DEFAULT_FILTERS,
    minMonthlyPrice: 1000,
  });

  assert.deepEqual(filtered, []);
});

test("negative and NaN price inputs are clamped to no-op (keep valid listings)", () => {
  const negative = filterBoardingHouses(listings, {
    ...BOARDING_HOUSE_DEFAULT_FILTERS,
    minMonthlyPrice: -500,
    maxMonthlyPrice: -1,
  });
  assert.deepEqual(
    negative.map((listing) => listing.id),
    ["bh-1", "bh-2"],
  );

  const notANumber = filterBoardingHouses(listings, {
    ...BOARDING_HOUSE_DEFAULT_FILTERS,
    minMonthlyPrice: Number.NaN,
    maxMonthlyPrice: Number.NaN,
  });
  assert.deepEqual(
    notANumber.map((listing) => listing.id),
    ["bh-1", "bh-2"],
  );
});

test("negative or NaN min-slots is clamped, but a real min-slots hides fully booked", () => {
  const clamped = filterBoardingHouses(listings, {
    ...BOARDING_HOUSE_DEFAULT_FILTERS,
    minAvailableSlots: -3,
  });
  assert.deepEqual(
    clamped.map((listing) => listing.id),
    ["bh-1", "bh-2"],
  );

  const requireOne = filterBoardingHouses(listings, {
    ...BOARDING_HOUSE_DEFAULT_FILTERS,
    minAvailableSlots: 1,
  });
  assert.deepEqual(
    requireOne.map((listing) => listing.id),
    ["bh-1"],
  );
});

test("minAvailableSlots of 0 keeps fully booked listings (availableSlots === 0)", () => {
  const filtered = filterBoardingHouses(listings, {
    ...BOARDING_HOUSE_DEFAULT_FILTERS,
    minAvailableSlots: 0,
  });

  assert.deepEqual(
    filtered.map((listing) => listing.id),
    ["bh-1", "bh-2"],
  );
});

test("sortBoardingHouseResults orders nearest listings first and leaves missing estimates last", () => {
  const sorted = sortBoardingHouseResults(
    [
      { listing: listings[0], meters: null },
      { listing: listings[1], meters: 900 },
      { listing: { ...unpricedListing, id: "bh-4" }, meters: 300 },
    ],
    "nearest",
  );

  assert.deepEqual(
    sorted.map((entry) => entry.listing.id),
    ["bh-4", "bh-2", "bh-1"],
  );
});

test("sortBoardingHouseResults sorts low prices with null prices last", () => {
  const sorted = sortBoardingHouseResults(
    [
      { listing: unpricedListing, meters: 100 },
      { listing: listings[1], meters: 100 },
      { listing: listings[0], meters: 100 },
    ],
    "price_asc",
  );

  assert.deepEqual(
    sorted.map((entry) => entry.listing.id),
    ["bh-1", "bh-2", "bh-3"],
  );
});

test("sortBoardingHouseResults sorts high prices by max then min with null prices last", () => {
  const sorted = sortBoardingHouseResults(
    [
      { listing: unpricedListing, meters: 100 },
      { listing: listings[0], meters: 100 },
      { listing: listings[1], meters: 100 },
    ],
    "price_desc",
  );

  assert.deepEqual(
    sorted.map((entry) => entry.listing.id),
    ["bh-2", "bh-1", "bh-3"],
  );
});

test("sortBoardingHouseResults sorts top rated listings before unrated listings", () => {
  const sorted = sortBoardingHouseResults(
    [
      { listing: listings[1], meters: 100 },
      {
        listing: {
          ...listings[0],
          id: "bh-4",
          averageRating: 4.5,
          reviewCount: 3,
        },
        meters: 100,
      },
      { listing: listings[0], meters: 100 },
    ],
    "top_rated",
  );

  assert.deepEqual(
    sorted.map((entry) => entry.listing.id),
    ["bh-1", "bh-4", "bh-2"],
  );
});

test("sortBoardingHouseResults sorts recently updated listings first", () => {
  const sorted = sortBoardingHouseResults(
    [
      { listing: listings[1], meters: 100 },
      { listing: listings[0], meters: 100 },
    ],
    "recently_updated",
  );

  assert.deepEqual(
    sorted.map((entry) => entry.listing.id),
    ["bh-1", "bh-2"],
  );
});

test("filterBoardingHouses applies drying area, smoking, and CCTV filters", () => {
  const dryingAndCctv = filterBoardingHouses(listings, {
    ...BOARDING_HOUSE_DEFAULT_FILTERS,
    dryingArea: true,
    cctv: true,
  });
  assert.deepEqual(dryingAndCctv.map((listing) => listing.id), ["bh-1"]);

  const smoking = filterBoardingHouses(listings, {
    ...BOARDING_HOUSE_DEFAULT_FILTERS,
    smokingAllowed: true,
  });
  assert.deepEqual(smoking.map((listing) => listing.id), ["bh-2"]);
});
