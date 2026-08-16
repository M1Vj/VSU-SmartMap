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

test("facility popup actions stay compact on desktop and expose a coarse-pointer hit target", () => {
  const markup = renderToStaticMarkup(
    <MapPopupCard
      facility={facility}
      onViewDetails={() => undefined}
      onDirections={() => null}
    />,
  );

  const buttons = markup.match(/<button\b[^>]*>/g) ?? [];
  assert.equal(buttons.length, 2);
  assert.equal(buttons.every((button) => /type="button"/.test(button)), true);
  assert.equal(buttons.every((button) => /data-map-popup-action="true"/.test(button)), true);
  assert.equal(buttons.every((button) => /h-8/.test(button) && /text-xs/.test(button)), true);
  assert.match(markup, /Details/);
  assert.match(markup, /Navigate/);
  assert.match(markup, /pr-10/);
});

test("facility popup no longer contains bottom-sheet or fake loading behavior", async () => {
  const source = await readFile(new URL("./map-popup-card.tsx", import.meta.url), "utf8");
  assert.match(source, /onDirections\?: \(\) => number \| null;/);
  assert.doesNotMatch(source, /layout\?:|bottom-sheet/);
  assert.match(source, /w-full min-w-\[200px\] max-w-\[260px\]/);
  assert.match(source, /className="flex gap-2"/);
  assert.equal((source.match(/data-map-popup-action="true"/g) ?? []).length, 2);
  assert.equal((source.match(/h-8 flex-1/g) ?? []).length, 2);
  assert.doesNotMatch(source, /min-h-11|min-w-\[6\.5rem\]|whitespace-normal/);
  assert.equal((source.match(/leading-tight/g) ?? []).length, 1);
  assert.doesNotMatch(source, /isBottomSheet/);
  assert.doesNotMatch(source, /layout\s*===/);
  assert.doesNotMatch(source, /layout\s*\?(?!:)/);
  assert.doesNotMatch(source, /setTimeout/);
  assert.doesNotMatch(source, /useState/);
  assert.doesNotMatch(source, /loading/);
});
