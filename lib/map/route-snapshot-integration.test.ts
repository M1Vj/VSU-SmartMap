import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { shouldClearRouteForSelectedItem } from "@/lib/navigation/selection-route-reset";

test("map page presents committed route metadata while a replacement request is pending", async () => {
  const source = await readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8");
  assert.match(source, /getPresentedNavigationSnapshot/);
  assert.match(source, /committedNavigation/);
  assert.match(source, /reportContext/);
  assert.match(source, /routeRequestDestinationId/);
  assert.match(source, /context=\{reportContext\}/);
  assert.match(source, /routeDestinationId/);
  assert.match(source, /routeSelectionDestinationId/);
  assert.match(source, /routeDestinationId: routeSelectionDestinationId/);
  assert.match(source, /navigationOrigin=\{navigationOrigin\}/);
});

test("pending replacement selection does not clear a committed route", () => {
  assert.equal(
    shouldClearRouteForSelectedItem({
      selectedItemId: "facility-new",
      routeDestinationId: "facility-new",
      hasNavigationState: true,
    }),
    false,
  );
  assert.equal(
    shouldClearRouteForSelectedItem({
      selectedItemId: "unrelated",
      routeDestinationId: "facility-new",
      hasNavigationState: true,
    }),
    true,
  );
});
