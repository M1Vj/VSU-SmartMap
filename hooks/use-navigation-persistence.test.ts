import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EMPTY_NAVIGATION_STATE,
  parseStoredNavigationState,
  removeStoredNavigationState,
} from "./use-navigation-persistence";

const now = 1_700_000_000_000;

test("valid persisted navigation retains route metadata for hydration", () => {
  const state = parseStoredNavigationState(
    {
      navStart: { lat: 11.0, lng: 124.0 },
      navEnd: { lat: 11.1, lng: 124.1 },
      destinationId: "facility-a",
      mode: "driving",
      origin: "manual",
      routeStartTime: now - 1_000,
    },
    now,
  );

  assert.deepEqual(state, {
    navStart: { lat: 11.0, lng: 124.0 },
    navEnd: { lat: 11.1, lng: 124.1 },
    destinationId: "facility-a",
    mode: "driving",
    origin: "manual",
    routeStartTime: now - 1_000,
  });
});

test("expired or incomplete persisted navigation cannot resurrect a cleared route", () => {
  assert.strictEqual(
    parseStoredNavigationState(
      {
        navStart: { lat: 11, lng: 124 },
        navEnd: { lat: 11.1, lng: 124.1 },
        destinationId: "facility-a",
        mode: "walking",
        origin: "live",
        routeStartTime: now - (2 * 60 * 60 * 1000),
      },
      now,
    ),
    EMPTY_NAVIGATION_STATE,
  );
  assert.strictEqual(
    parseStoredNavigationState({ navStart: { lat: 11, lng: 124 } }, now),
    EMPTY_NAVIGATION_STATE,
  );
});

test("disabled storage cannot turn cleanup into a persistence error", () => {
  const globalObject = globalThis as typeof globalThis & {
    window?: unknown;
    localStorage?: unknown;
  };
  const previousWindow = globalObject.window;
  const previousStorage = globalObject.localStorage;
  try {
    Object.defineProperty(globalObject, "window", { configurable: true, value: {} });
    Object.defineProperty(globalObject, "localStorage", {
      configurable: true,
      value: { removeItem: () => { throw new Error("storage disabled"); } },
    });
    assert.doesNotThrow(() => removeStoredNavigationState());
  } finally {
    if (previousWindow === undefined) Reflect.deleteProperty(globalObject, "window");
    else Object.defineProperty(globalObject, "window", { configurable: true, value: previousWindow });
    if (previousStorage === undefined) Reflect.deleteProperty(globalObject, "localStorage");
    else Object.defineProperty(globalObject, "localStorage", { configurable: true, value: previousStorage });
  }
});

test("the persistence hook keeps route timestamps internal", async () => {
  const source = await readFile(new URL("./use-navigation-persistence.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /routeStartTime: navigationState\.routeStartTime/);
});
