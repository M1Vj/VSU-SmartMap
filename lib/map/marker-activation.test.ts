import assert from "node:assert/strict";
import test from "node:test";

import { shouldSuppressCompatibilityActivation, type MarkerActivation } from "./marker-activation.ts";

const touchActivation: MarkerActivation = {
  lat: 10.7445,
  lng: 124.7923,
  at: 100,
  input: "touch",
  compatibility: false,
};

test("suppresses only the compatibility mouse event for one touch activation", () => {
  assert.equal(
    shouldSuppressCompatibilityActivation(touchActivation, {
      ...touchActivation,
      at: 140,
      input: "mouse",
      compatibility: true,
    }),
    true,
  );
});

test("keeps intentional repeated taps and unrelated activations", () => {
  assert.equal(
    shouldSuppressCompatibilityActivation(touchActivation, {
      ...touchActivation,
      at: 140,
      input: "touch",
    }),
    false,
  );
  assert.equal(
    shouldSuppressCompatibilityActivation(
      { ...touchActivation, at: 120 },
      { ...touchActivation, at: 180, input: "touch" },
    ),
    false,
  );
  assert.equal(
    shouldSuppressCompatibilityActivation(touchActivation, {
      ...touchActivation,
      at: 140,
      lng: touchActivation.lng + 0.001,
      input: "mouse",
      compatibility: true,
    }),
    false,
  );
  assert.equal(
    shouldSuppressCompatibilityActivation(touchActivation, {
      ...touchActivation,
      at: 700,
      input: "mouse",
      compatibility: true,
    }),
    false,
  );
});
