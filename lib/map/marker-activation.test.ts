import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveMarkerActivation,
  shouldSuppressCompatibilityActivation,
  type MarkerActivation,
} from "./marker-activation.ts";

const touchActivation: MarkerActivation = {
  lat: 10.7445,
  lng: 124.7923,
  at: 100,
  input: "touch",
  compatibility: false,
  awaitingCompatibility: true,
  activationId: 1,
};

test("suppresses only the compatibility mouse event for one touch activation", () => {
  assert.equal(
    shouldSuppressCompatibilityActivation(touchActivation, {
      ...touchActivation,
      at: 140,
      input: "mouse",
      compatibility: true,
      awaitingCompatibility: false,
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
      awaitingCompatibility: true,
    }),
    false,
  );
  assert.equal(
    shouldSuppressCompatibilityActivation(
      { ...touchActivation, at: 120 },
      { ...touchActivation, at: 180, input: "touch", awaitingCompatibility: true },
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
      awaitingCompatibility: false,
    }),
    false,
  );
  assert.equal(
    shouldSuppressCompatibilityActivation(touchActivation, {
      ...touchActivation,
      at: 700,
      input: "mouse",
      compatibility: true,
      awaitingCompatibility: false,
    }),
    false,
  );
});

test("recognizes an absent-metadata compatibility click after a recorded touch", () => {
  const result = resolveMarkerActivation({
    lat: touchActivation.lat,
    lng: touchActivation.lng,
    at: 140,
    previous: touchActivation,
    pending: null,
  });

  assert.equal(result.activation.compatibility, true);
  assert.equal(result.suppress, true);
});

test("keeps a second touch and a genuine mouse click independent", () => {
  const secondTouch = resolveMarkerActivation({
    lat: touchActivation.lat,
    lng: touchActivation.lng,
    at: 140,
    previous: touchActivation,
    pending: { ...touchActivation, at: 135, activationId: 2, awaitingCompatibility: true },
  });
  assert.equal(secondTouch.activation.input, "touch");
  assert.equal(secondTouch.suppress, false);

  const metadataFreeSecondTouch = resolveMarkerActivation({
    lat: touchActivation.lat,
    lng: touchActivation.lng,
    at: 150,
    previous: touchActivation,
    pending: { ...touchActivation, at: 145, activationId: undefined },
  });
  assert.equal(metadataFreeSecondTouch.activation.input, "touch");
  assert.equal(metadataFreeSecondTouch.suppress, false);

  const genuineMouse = resolveMarkerActivation({
    lat: touchActivation.lat,
    lng: touchActivation.lng,
    at: 150,
    pointerType: "mouse",
    previous: touchActivation,
    pending: { ...touchActivation, at: 145, input: "mouse", activationId: 3, awaitingCompatibility: false },
  });
  assert.equal(genuineMouse.activation.input, "mouse");
  assert.equal(genuineMouse.activation.compatibility, false);
  assert.equal(genuineMouse.suppress, false);

  const metadataFreeMouse = resolveMarkerActivation({
    lat: touchActivation.lat,
    lng: touchActivation.lng,
    at: 160,
    previous: touchActivation,
    pending: {
      ...touchActivation,
      at: 155,
      input: "mouse",
      activationId: 4,
      awaitingCompatibility: false,
    },
  });
  assert.equal(metadataFreeMouse.activation.input, "mouse");
  assert.equal(metadataFreeMouse.activation.compatibility, false);
  assert.equal(metadataFreeMouse.suppress, false);

  const pointerCompatibilityMouse = resolveMarkerActivation({
    lat: touchActivation.lat,
    lng: touchActivation.lng,
    at: 145,
    pointerType: "mouse",
    previous: touchActivation,
    pending: { ...touchActivation, at: 140, activationId: 1 },
  });
  assert.equal(pointerCompatibilityMouse.activation.compatibility, true);
  assert.equal(pointerCompatibilityMouse.suppress, true);
});
