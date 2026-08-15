import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { BoardingHouseSummary } from "@/lib/boarding-houses/types";
import { BoardingHouseMapPopupCard } from "./boarding-house-map-popup-card";

const listing = {
  id: "boarding-1",
  slug: "boarding-1",
  name: "Boarding House 1",
  status: "published",
  verificationStatus: "verified",
  addressLine: "Campus Road",
  coordinates: { lat: 10.744, lng: 124.79 },
  thumbnailUrl: null,
  coverPhotoBucket: null,
  coverPhotoPath: null,
  priceMin: 5000,
  priceMax: 6000,
  priceChangedAt: null,
  availableSlots: 2,
  roomTypes: ["private_room"],
  occupancyPolicies: ["any_gender"],
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
  ownerDisplayName: "Owner",
  averageRating: 4.5,
  reviewCount: 2,
  safetyFeatures: ["cctv"],
  applianceFee: null,
  mobileCarriers: ["smart"],
  publishedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as BoardingHouseSummary;

test("boarding popup keeps Details as a semantic link and Navigate as a 44px button", () => {
  const markup = renderToStaticMarkup(
    <BoardingHouseMapPopupCard listing={listing} onDirections={() => null} />,
  );

  const buttons = markup.match(/<button\b[^>]*>/g) ?? [];
  const links = markup.match(/<a\b[^>]*>/g) ?? [];
  assert.equal(buttons.length, 1);
  assert.match(buttons[0], /type="button"/);
  assert.match(buttons[0], /h-auto/);
  assert.match(buttons[0], /min-h-11/);
  assert.match(buttons[0], /min-w-\[6\.5rem\]/);
  assert.match(markup, /<a\b[^>]*href="\/boarding-houses\/boarding-1"/);
  assert.match(markup, /<a\b[^>]*class="[^"\n]*h-auto[^"\n]*min-h-11/);
  assert.equal(links.every((link) => /min-w-\[6\.5rem\]/.test(link)), true);
  assert.match(markup, /pr-10/);
});

test("boarding popup has no bottom-sheet or timer-based action behavior", async () => {
  const source = await readFile(
    new URL("./boarding-house-map-popup-card.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /onDirections\?: \(\) => number \| null;/);
  assert.doesNotMatch(source, /layout\?:|bottom-sheet/);
  assert.match(source, /className="flex w-full flex-wrap gap-2"/);
  assert.match(source, /<Link[^>]*className="min-w-\[6\.5rem\] flex-1 whitespace-normal text-center leading-tight"/);
  assert.match(
    source,
    /h-auto min-h-11 min-w-\[6\.5rem\] flex-1 gap-2 whitespace-normal px-3 py-2 text-center text-xs leading-tight bg-blue-600/,
  );
  assert.equal((source.match(/h-auto min-h-11/g) ?? []).length, 2);
  assert.equal((source.match(/whitespace-normal/g) ?? []).length, 3);
  assert.equal((source.match(/leading-tight/g) ?? []).length >= 2, true);
  assert.doesNotMatch(source, /isBottomSheet/);
  assert.doesNotMatch(source, /layout\s*===/);
  assert.doesNotMatch(source, /layout\s*\?(?!:)/);
  assert.doesNotMatch(source, /setTimeout/);
  assert.doesNotMatch(source, /useState/);
  assert.doesNotMatch(source, /loading/);
});
