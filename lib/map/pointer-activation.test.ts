import assert from "node:assert/strict";
import test from "node:test";
import {
  createPointerActivation,
  isPrimaryCompatibilityClick,
  isPrimaryPointerActivation,
  isPointerTap,
  shouldDedupeCompatibilityClick,
  type PointerActivationEvent,
} from "./pointer-activation";

const event = (overrides: Partial<PointerActivationEvent> = {}): PointerActivationEvent => ({
  pointerId: 7,
  pointerType: "mouse",
  clientX: 100,
  clientY: 100,
  timeStamp: 1000,
  ...overrides,
});

for (const pointerType of ["mouse", "touch", "pen"] as const) {
  test(`${pointerType} tap stays eligible for marker activation`, () => {
    const start = createPointerActivation("facility-1", event({ pointerType }));
    assert.equal(isPointerTap(start, event({ pointerType, timeStamp: 1100 })), true);
    assert.equal(start.activationId, "facility-1:pointer:7:1000");
  });
}

test("pointer movement beyond tap tolerance cancels marker activation", () => {
  const start = createPointerActivation("facility-1", event());
  assert.equal(isPointerTap(start, event({ clientX: 113, timeStamp: 1100 })), false);
});

test("pointer duration beyond tap threshold cancels marker activation", () => {
  const start = createPointerActivation("facility-1", event());
  assert.equal(isPointerTap(start, event({ timeStamp: 1401 })), false);
});

test("pointer identity must match before a pointerup can activate", () => {
  const start = createPointerActivation("facility-1", event({ pointerId: 7 }));
  assert.equal(isPointerTap(start, event({ pointerId: 8, timeStamp: 1100 })), false);
});

test("only primary left-button pointers can activate markers", () => {
  assert.equal(isPrimaryPointerActivation(event({ button: 0, isPrimary: true })), true);
  assert.equal(isPrimaryPointerActivation(event({ button: 2, isPrimary: true })), false);
  assert.equal(isPrimaryPointerActivation(event({ button: 1, isPrimary: true })), false);
  assert.equal(isPrimaryPointerActivation(event({ button: 0, isPrimary: false })), false);
  assert.equal(isPrimaryPointerActivation(event({ pointerType: "touch", isPrimary: true })), true);
  assert.equal(isPrimaryPointerActivation(event({ pointerType: "pen", isPrimary: true })), true);
});

test("compatibility clicks accept a primary left button even when isPrimary is false", () => {
  assert.equal(isPrimaryCompatibilityClick({ button: 0, isPrimary: false }), true);
  assert.equal(isPrimaryCompatibilityClick({ button: 2, isPrimary: false }), false);
  assert.equal(isPrimaryCompatibilityClick({ button: 1, isPrimary: true }), false);
  assert.equal(isPrimaryCompatibilityClick({}), true);
});

test("compatibility click dedupes only the same physical pointer identity", () => {
  const activation = createPointerActivation("facility-1", event({ pointerId: 7, timeStamp: 1000 }));
  const record = {
    activationId: activation.activationId,
    modality: "mouse" as const,
    pointerId: activation.pointerId,
    at: 1100,
  };
  assert.equal(
    shouldDedupeCompatibilityClick(record, { pointerId: 7, detail: 1 }, 1150),
    true,
  );
  assert.equal(
    shouldDedupeCompatibilityClick(record, { pointerId: 8, detail: 1 }, 1150),
    false,
  );
  for (const modality of ["mouse", "touch", "pen"] as const) {
    assert.equal(
      shouldDedupeCompatibilityClick({ ...record, modality }, { detail: 1 }, 1150),
      true,
      `${modality} compatibility clicks without pointerId still dedupe`,
    );
  }
  assert.equal(shouldDedupeCompatibilityClick(record, { detail: 1 }, 2700), false);
});

test("keyboard synthesized click dedupes only a detail-zero activation", () => {
  const record = { activationId: "facility-1:keyboard:1000", modality: "keyboard" as const, pointerId: null, at: 1100 };
  assert.equal(shouldDedupeCompatibilityClick(record, { detail: 0 }, 1150), true);
  assert.equal(shouldDedupeCompatibilityClick(record, { detail: 1 }, 1150), false);
});
