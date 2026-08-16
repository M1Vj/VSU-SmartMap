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

test("boarding popup keeps Details as a semantic link and stays compact on desktop", () => {
  const markup = renderToStaticMarkup(
    <BoardingHouseMapPopupCard listing={listing} onDirections={() => null} />,
  );

  const buttons = markup.match(/<button\b[^>]*>/g) ?? [];
  const links = markup.match(/<a\b[^>]*>/g) ?? [];
  assert.equal(buttons.length, 1);
  assert.match(buttons[0], /type="button"/);
  assert.match(buttons[0], /data-map-popup-action="true"/);
  assert.match(buttons[0], /h-8/);
  assert.match(markup, /<a\b[^>]*href="\/boarding-houses\/boarding-1"/);
  assert.match(markup, /<a\b[^>]*data-map-popup-action="true"/);
  assert.match(markup, /<a\b[^>]*class="[^"\n]*h-8/);
  assert.match(markup, /pr-10/);
});

test("boarding popup has no bottom-sheet or timer-based action behavior", async () => {
  const source = await readFile(
    new URL("./boarding-house-map-popup-card.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /onDirections\?: \(\) => number \| null;/);
  assert.doesNotMatch(source, /layout\?:|bottom-sheet/);
  assert.match(source, /className="flex gap-2"/);
  assert.match(source, /<Link[^>]*data-map-popup-action="true"/);
  assert.match(source, /data-map-popup-action="true"/);
  assert.match(source, /h-8 flex-1 gap-2 bg-blue-600 text-xs/);
  assert.equal((source.match(/data-map-popup-action="true"/g) ?? []).length, 2);
  assert.equal((source.match(/h-8 flex-1/g) ?? []).length >= 2, true);
  assert.doesNotMatch(source, /min-h-11|min-w-\[6\.5rem\]|whitespace-normal/);
  assert.equal((source.match(/leading-tight/g) ?? []).length >= 1, true);
  assert.doesNotMatch(source, /isBottomSheet/);
  assert.doesNotMatch(source, /layout\s*===/);
  assert.doesNotMatch(source, /layout\s*\?(?!:)/);
  assert.doesNotMatch(source, /setTimeout/);
  assert.doesNotMatch(source, /useState/);
  assert.doesNotMatch(source, /loading/);
});
