import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPartialStreamFinalPayload,
  shouldFinalizePartialStream,
} from "./streaming.ts";

test("shouldFinalizePartialStream keeps streamed content instead of appending an error", () => {
  assert.equal(shouldFinalizePartialStream("Hello from streamed text"), true);
  assert.equal(shouldFinalizePartialStream("   "), false);
});

test("buildPartialStreamFinalPayload keeps recovered facility metadata for cards", () => {
  const facilities = [
    {
      facility: {
        id: "admin-building",
        name: "Administration Building",
      },
      matchReason: "",
      confidence: 1,
    },
  ];

  assert.deepEqual(
    buildPartialStreamFinalPayload("The Admin Building is near the center.", {
      content: "I found this location for you:",
      facilities,
    }),
    {
      type: "final",
      content: "I found this location for you:",
      facilities,
      events: undefined,
      boardingHouses: undefined,
    }
  );
});

test("buildPartialStreamFinalPayload keeps recovered boarding house metadata for cards", () => {
  const boardingHouses = [
    {
      listingId: "listing-1",
      name: "Green Gate Residence",
      slug: "green-gate",
    },
  ];

  assert.deepEqual(
    buildPartialStreamFinalPayload("Green Gate has bedspace listings.", {
      content: "I found this boarding house for you:",
      boardingHouses,
    }),
    {
      type: "final",
      content: "I found this boarding house for you:",
      facilities: undefined,
      events: undefined,
      boardingHouses,
    }
  );
});

test("buildPartialStreamFinalPayload falls back to streamed text without recovered metadata", () => {
  assert.deepEqual(
    buildPartialStreamFinalPayload("The Admin Building is near the center."),
    {
      type: "final",
      content: "The Admin Building is near the center.",
      facilities: undefined,
      events: undefined,
      boardingHouses: undefined,
    }
  );
});
