import assert from "node:assert/strict";
import test from "node:test";
import { createInteractionGateway } from "./interaction-gateway";
import { createPointerActivation, isPointerTap } from "./pointer-activation";

test("pointer activation and its compatibility click select a marker once", () => {
  const selected: string[] = [];
  const gateway = createInteractionGateway({ onMarkerActivate: (id) => selected.push(id) });

  gateway.dispatch({ type: "marker", itemId: "facility-1", activationId: "pointer-7", modality: "mouse" });
  gateway.dispatch({ type: "marker", itemId: "facility-1", activationId: "pointer-7", modality: "mouse" });
  gateway.dispatch({ type: "background", target: "marker" });

  assert.deepEqual(selected, ["facility-1"]);
});

test("keyboard marker activation is not consumed by the map background", () => {
  const selected: string[] = [];
  const cleared: number[] = [];
  const gateway = createInteractionGateway({
    onMarkerActivate: (id) => selected.push(id),
    onBackground: () => cleared.push(1),
  });

  gateway.dispatch({ type: "marker", itemId: "facility-2", activationId: "key-1", modality: "keyboard" });
  gateway.dispatch({ type: "background", target: "marker", activationId: "key-1" });
  gateway.dispatch({ type: "background", target: "background", activationId: "bg-1" });

  assert.deepEqual(selected, ["facility-2"]);
  assert.deepEqual(cleared, [1]);
});

test("manual-start touch placement and its compatibility click share one background activation", () => {
  const placements: Array<{ lat: number; lng: number }> = [];
  const cleared: number[] = [];
  const gateway = createInteractionGateway({
    onMarkerActivate: () => undefined,
    onBackground: (point) => {
      if (point) placements.push(point);
      else cleared.push(1);
    },
  });
  const point = { lat: 10, lng: 10 };
  gateway.dispatch({ type: "background", target: "background", activationId: "background:pointer:9:100", point });
  gateway.dispatch({ type: "background", target: "background", activationId: "background:pointer:9:100", point });
  assert.deepEqual(placements, [point]);
  assert.deepEqual(cleared, []);
});

test("background touch clears once outside manual-start mode", () => {
  const cleared: number[] = [];
  const gateway = createInteractionGateway({
    onMarkerActivate: () => undefined,
    onBackground: () => cleared.push(1),
  });
  gateway.dispatch({ type: "background", target: "background", activationId: "background:pointer:3:100" });
  gateway.dispatch({ type: "background", target: "background", activationId: "background:pointer:3:100" });
  assert.deepEqual(cleared, [1]);
});

test("marker and control targets never become background activations", () => {
  const selected: string[] = [];
  const cleared: number[] = [];
  const gateway = createInteractionGateway({
    onMarkerActivate: (itemId) => selected.push(itemId),
    onBackground: () => cleared.push(1),
  });
  gateway.dispatch({ type: "background", target: "marker", activationId: "marker-pointer-1" });
  gateway.dispatch({ type: "background", target: "control", activationId: "control-pointer-1" });
  gateway.dispatch({ type: "marker", itemId: "facility-1", activationId: "marker-pointer-1", modality: "mouse" });
  assert.deepEqual(selected, ["facility-1"]);
  assert.deepEqual(cleared, []);
});

test("selection transfer activates marker B once without a background clear", () => {
  const selected: string[] = [];
  const cleared: number[] = [];
  const gateway = createInteractionGateway({
    onMarkerActivate: (itemId) => selected.push(itemId),
    onBackground: () => cleared.push(1),
  });

  gateway.dispatch({ type: "marker", itemId: "facility-a", activationId: "a-1", modality: "touch" });
  gateway.dispatch({ type: "marker", itemId: "facility-b", activationId: "b-1", modality: "touch" });
  gateway.dispatch({ type: "background", target: "marker", activationId: "a-popup-close" });

  assert.deepEqual(selected, ["facility-a", "facility-b"]);
  assert.deepEqual(cleared, []);
});

test("background drag and pointer cancellation never place a manual start", () => {
  const placements: number[] = [];
  const gateway = createInteractionGateway({
    onMarkerActivate: () => undefined,
    onBackground: (point) => {
      if (point) placements.push(1);
    },
  });
  const activation = createPointerActivation("background", {
    pointerId: 8,
    pointerType: "touch",
    clientX: 100,
    clientY: 100,
    timeStamp: 1000,
  });
  assert.equal(isPointerTap(activation, {
    pointerId: 8,
    pointerType: "touch",
    clientX: 140,
    clientY: 100,
    timeStamp: 1100,
  }), false);
  // The gateway receives no activation for a canceled/dragged pointer.
  if (isPointerTap(activation, {
    pointerId: 8,
    pointerType: "touch",
    clientX: 140,
    clientY: 100,
    timeStamp: 1100,
  })) {
    gateway.dispatch({
      type: "background",
      target: "background",
      activationId: activation.activationId,
      point: { lat: 10, lng: 10 },
    });
  }
  assert.deepEqual(placements, []);
});
