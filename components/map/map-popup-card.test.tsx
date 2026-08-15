import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MapPopupCard } from "./map-popup-card";
import type { Facility } from "@/lib/types/facility";

const facility = {
  id: "dass",
  slug: "dass",
  name: "DASS",
  category: "academic",
  coordinates: { lat: 10.744, lng: 124.79 },
  hasRooms: false,
  createdAt: "2026-01-01T00:00:00.000Z",
} as Facility;

test("facility popup actions use explicit 44px button semantics", () => {
  const markup = renderToStaticMarkup(
    <MapPopupCard
      facility={facility}
      onViewDetails={() => undefined}
      onDirections={() => undefined}
    />,
  );

  const buttons = markup.match(/<button\b[^>]*>/g) ?? [];
  assert.equal(buttons.length, 2);
  assert.equal(buttons.every((button) => /type="button"/.test(button)), true);
  assert.equal(buttons.every((button) => /h-11/.test(button) && /min-h-11/.test(button)), true);
  assert.match(markup, /Details/);
  assert.match(markup, /Navigate/);
  assert.match(markup, /pr-10/);
});

test("facility popup no longer contains bottom-sheet or fake loading behavior", async () => {
  const source = await readFile(new URL("./map-popup-card.tsx", import.meta.url), "utf8");
  assert.match(source, /layout\?: "popup" \| "bottom-sheet"/);
  assert.doesNotMatch(source, /isBottomSheet/);
  assert.doesNotMatch(source, /layout\s*===/);
  assert.doesNotMatch(source, /layout\s*\?(?!:)/);
  assert.doesNotMatch(source, /setTimeout/);
  assert.doesNotMatch(source, /useState/);
  assert.doesNotMatch(source, /loading/);
});
