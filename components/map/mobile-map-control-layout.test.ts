import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile map actions preserve their navigation clearance across safe areas", async () => {
  const [mapPageSource, locationControlSource, bottomCardSource] =
    await Promise.all([
    readFile(
      new URL("../../app/(student)/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("./user-location-control.tsx", import.meta.url), "utf8"),
      readFile(new URL("./map-bottom-card.tsx", import.meta.url), "utf8"),
    ]);

  assert.match(
    mapPageSource,
    /bottom-\[calc\(6\.5rem\+env\(safe-area-inset-bottom\)\)\]/,
  );
  assert.equal(
    mapPageSource.match(
      /bottom-\[calc\(6\.5rem\+env\(safe-area-inset-bottom\)\)\]/g,
    )?.length,
    2,
  );
  assert.doesNotMatch(mapPageSource, /absolute bottom-12/);
  assert.match(mapPageSource, /md:bottom-12/);
  assert.match(
    locationControlSource,
    /bottom-\[calc\(10rem\+env\(safe-area-inset-bottom\)\)\]/,
  );
  assert.match(
    bottomCardSource,
    /bottom-\[calc\(6\.5rem\+env\(safe-area-inset-bottom,0px\)\)\]/,
  );
});
