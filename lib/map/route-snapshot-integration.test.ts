import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("map page presents committed route metadata while a replacement request is pending", async () => {
  const source = await readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8");
  assert.match(source, /getPresentedNavigationSnapshot/);
  assert.match(source, /committedNavigation/);
  assert.match(source, /reportContext/);
  assert.match(source, /routeRequestDestinationId/);
  assert.match(source, /context=\{reportContext\}/);
  assert.match(source, /routeDestinationId/);
  assert.match(source, /navigationOrigin=\{navigationOrigin\}/);
});
