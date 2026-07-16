import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldClearRouteForMapSearch,
  shouldClearRouteForSelectedItem,
} from "./selection-route-reset.ts";

test("clears an existing route when a different map item is selected", () => {
  assert.equal(
    shouldClearRouteForSelectedItem({
      selectedItemId: "bougainvillea",
      routeDestinationId: null,
      hasNavigationState: true,
    }),
    true,
  );

  assert.equal(
    shouldClearRouteForSelectedItem({
      selectedItemId: "bougainvillea",
      routeDestinationId: "administration-building",
      hasNavigationState: true,
    }),
    true,
  );
});

test("keeps navigation when selecting the current route destination or when no route exists", () => {
  assert.equal(
    shouldClearRouteForSelectedItem({
      selectedItemId: "bougainvillea",
      routeDestinationId: "bougainvillea",
      hasNavigationState: true,
    }),
    false,
  );

  assert.equal(
    shouldClearRouteForSelectedItem({
      selectedItemId: "bougainvillea",
      routeDestinationId: null,
      hasNavigationState: false,
    }),
    false,
  );

  assert.equal(
    shouldClearRouteForSelectedItem({
      selectedItemId: null,
      routeDestinationId: "bougainvillea",
      hasNavigationState: true,
    }),
    false,
  );
});

test("clears an existing route when search text no longer matches the selected item", () => {
  assert.equal(
    shouldClearRouteForMapSearch({
      searchQuery: "bougainvillea",
      selectedItemName: null,
      hasNavigationState: true,
    }),
    true,
  );

  assert.equal(
    shouldClearRouteForMapSearch({
      searchQuery: "bougainvillea",
      selectedItemName: "Administration Building",
      hasNavigationState: true,
    }),
    true,
  );
});

test("keeps navigation for empty searches, matching selected items, and empty route state", () => {
  assert.equal(
    shouldClearRouteForMapSearch({
      searchQuery: "  ",
      selectedItemName: "Administration Building",
      hasNavigationState: true,
    }),
    false,
  );

  assert.equal(
    shouldClearRouteForMapSearch({
      searchQuery: "Administration Building",
      selectedItemName: "Administration Building",
      hasNavigationState: true,
    }),
    false,
  );

  assert.equal(
    shouldClearRouteForMapSearch({
      searchQuery: "bougainvillea",
      selectedItemName: "Administration Building",
      hasNavigationState: false,
    }),
    false,
  );
});
