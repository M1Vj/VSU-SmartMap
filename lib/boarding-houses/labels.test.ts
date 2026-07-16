import test from "node:test";
import assert from "node:assert/strict";

import {
  formatAvailabilityLabel,
  formatSlotCount,
  formatSlotsListedLabel,
  formatWalkEstimateLabel,
} from "./labels.ts";

test("formatSlotCount pluralizes available slots", () => {
  assert.equal(formatSlotCount(1), "1 slot");
  assert.equal(formatSlotCount(4), "4 slots");
});

test("formatAvailabilityLabel matches student-card availability wording", () => {
  assert.equal(formatAvailabilityLabel(null), "Slots on request");
  assert.equal(formatAvailabilityLabel(0), "Fully booked");
  assert.equal(formatAvailabilityLabel(1), "1 slot");
  assert.equal(formatAvailabilityLabel(4), "4 slots");
});

test("formatSlotsListedLabel pluralizes owner listed slots", () => {
  assert.equal(formatSlotsListedLabel(1), "1 slot listed");
  assert.equal(formatSlotsListedLabel(4), "4 slots listed");
});

test("formatWalkEstimateLabel matches card wording for routed and approximate walks", () => {
  assert.equal(
    formatWalkEstimateLabel(
      { meters: 1120, minutes: 15, approximate: false },
      "campus gate",
    ),
    "1.1 km · 15 min walk to campus gate",
  );
  assert.equal(
    formatWalkEstimateLabel(
      { meters: 1120, minutes: 15, approximate: true },
      "campus gate",
    ),
    "~1.1 km · ~15 min to campus gate (approx)",
  );
});
