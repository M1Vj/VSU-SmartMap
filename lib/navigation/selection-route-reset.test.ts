import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldClearRouteForMapSearch,
  shouldClearRouteForSelectedItem,
  shouldRestoreCommittedRouteForSelectedItem,
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

test("keeps the committed route when selecting its destination after a failed replacement", () => {
  assert.equal(
    shouldClearRouteForSelectedItem({
      selectedItemId: "facility-a",
      routeDestinationId: "facility-b",
      committedRouteDestinationId: "facility-a",
      hasNavigationState: true,
    }),
    false,
  );

  assert.equal(
    shouldClearRouteForSelectedItem({
      selectedItemId: "facility-c",
      routeDestinationId: "facility-b",
      committedRouteDestinationId: "facility-a",
      hasNavigationState: true,
    }),
    true,
  );
});

test("restores the committed route only when its destination is selected during a pending replacement", () => {
  assert.equal(
    shouldRestoreCommittedRouteForSelectedItem({
      selectedItemId: "facility-a",
      routeDestinationId: "facility-b",
      committedRouteDestinationId: "facility-a",
      pendingRequestId: 2,
    }),
    true,
  );
  assert.equal(
    shouldRestoreCommittedRouteForSelectedItem({
      selectedItemId: "facility-b",
      routeDestinationId: "facility-b",
      committedRouteDestinationId: "facility-a",
      pendingRequestId: 2,
    }),
    false,
  );
  assert.equal(
    shouldRestoreCommittedRouteForSelectedItem({
      selectedItemId: "facility-a",
      routeDestinationId: "facility-b",
      committedRouteDestinationId: "facility-a",
      pendingRequestId: null,
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
