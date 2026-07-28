import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEFAULT_VISIBLE_STUDENT_DESTINATIONS,
  STUDENT_DESTINATIONS,
  normalizeVisibleStudentDestinations,
  parseVisibleStudentDestinations,
  readVisibleStudentDestinations,
  readVisibleStudentDestinationsFromProvider,
  resetVisibleStudentDestinations,
  serializeVisibleStudentDestinations,
  studentDestinationForPath,
  studentDestinationRoute,
  toggleVisibleStudentDestination,
  writeVisibleStudentDestinations,
  writeVisibleStudentDestinationsFromProvider,
} from "./student-navigation.ts";

test("student destinations define the product order and defaults", () => {
  assert.deepEqual(
    STUDENT_DESTINATIONS.map(({ id, label, route, defaultVisible, required }) => ({
      id,
      label,
      route,
      defaultVisible,
      required,
    })),
    [
      { id: "map", label: "Map", route: "/", defaultVisible: true, required: true },
      { id: "schedule", label: "Schedule", route: "/schedule", defaultVisible: true, required: false },
      { id: "boarding", label: "Boarding", route: "/boarding-houses", defaultVisible: true, required: false },
      { id: "events", label: "Events", route: "/events", defaultVisible: true, required: false },
      { id: "directory", label: "Directory", route: "/directory", defaultVisible: true, required: false },
      { id: "chat", label: "Chat", route: "/chat", defaultVisible: true, required: false },
    ],
  );
  assert.deepEqual(DEFAULT_VISIBLE_STUDENT_DESTINATIONS, [
    "map",
    "schedule",
    "boarding",
    "events",
    "directory",
    "chat",
  ]);
});

test("normalizeVisibleStudentDestinations removes invalid and duplicate IDs in product order", () => {
  assert.deepEqual(
    normalizeVisibleStudentDestinations(["chat", "unknown", "events", "chat", "schedule"]),
    ["map", "schedule", "events", "chat"],
  );
});

test("normalizeVisibleStudentDestinations treats an empty optional selection as map only", () => {
  assert.deepEqual(normalizeVisibleStudentDestinations([]), ["map"]);
});

test("studentDestinationForPath recognizes exact and nested destination routes", () => {
  assert.equal(studentDestinationForPath("/schedule"), "schedule");
  assert.equal(studentDestinationForPath("/boarding-houses"), "boarding");
  assert.equal(studentDestinationForPath("/boarding-houses/campus-view"), "boarding");
  assert.equal(studentDestinationForPath("/not-a-student-route"), "map");
});

test("studentDestinationRoute returns the centralized route", () => {
  assert.equal(studentDestinationRoute("schedule"), "/schedule");
  assert.equal(studentDestinationRoute("map"), "/");
});

test("every default-visible destination resolves to a student page", () => {
  for (const destination of STUDENT_DESTINATIONS.filter(({ defaultVisible }) => defaultVisible)) {
    const pagePath = destination.route === "/"
      ? "app/(student)/page.tsx"
      : `app/(student)${destination.route}/page.tsx`;
    assert.equal(existsSync(resolve(process.cwd(), pagePath)), true, `${destination.route} is missing ${pagePath}`);
  }
});

test("parseVisibleStudentDestinations validates JSON and normalizes IDs", () => {
  assert.deepEqual(parseVisibleStudentDestinations('["chat","unknown","schedule","chat"]'), [
    "map",
    "schedule",
    "chat",
  ]);
  assert.deepEqual(parseVisibleStudentDestinations("{malformed"), DEFAULT_VISIBLE_STUDENT_DESTINATIONS);
  assert.deepEqual(parseVisibleStudentDestinations('{"map":true}'), DEFAULT_VISIBLE_STUDENT_DESTINATIONS);
  assert.deepEqual(parseVisibleStudentDestinations(null), DEFAULT_VISIBLE_STUDENT_DESTINATIONS);
});

test("serializeVisibleStudentDestinations persists only normalized IDs", () => {
  assert.equal(
    serializeVisibleStudentDestinations(["chat", "unknown", "chat"]),
    '["map","chat"]',
  );
});

test("storage helpers tolerate get and set failures", () => {
  const throwingStorage = {
    getItem(): string | null {
      throw new Error("storage blocked");
    },
    setItem(): void {
      throw new Error("storage blocked");
    },
  };
  assert.deepEqual(readVisibleStudentDestinations(throwingStorage), DEFAULT_VISIBLE_STUDENT_DESTINATIONS);
  assert.doesNotThrow(() => writeVisibleStudentDestinations(throwingStorage, ["schedule"]));
});

test("storage provider helpers tolerate localStorage property access failures", () => {
  const throwingProvider = (): Storage => {
    throw new Error("localStorage getter blocked");
  };

  assert.deepEqual(
    readVisibleStudentDestinationsFromProvider(throwingProvider),
    DEFAULT_VISIBLE_STUDENT_DESTINATIONS,
  );
  assert.doesNotThrow(() =>
    writeVisibleStudentDestinationsFromProvider(throwingProvider, ["schedule"]),
  );
});

test("toggle and reset keep Map required and preserve product order", () => {
  assert.deepEqual(toggleVisibleStudentDestination(["map", "schedule"], "map"), ["map", "schedule"]);
  assert.deepEqual(toggleVisibleStudentDestination(["map", "chat"], "schedule"), ["map", "schedule", "chat"]);
  assert.deepEqual(toggleVisibleStudentDestination(["map", "schedule"], "schedule"), ["map"]);
  assert.deepEqual(resetVisibleStudentDestinations(), DEFAULT_VISIBLE_STUDENT_DESTINATIONS);
  assert.notEqual(resetVisibleStudentDestinations(), DEFAULT_VISIBLE_STUDENT_DESTINATIONS);
});
