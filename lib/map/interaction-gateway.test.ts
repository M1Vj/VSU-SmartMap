import assert from "node:assert/strict";
import test from "node:test";
import { createInteractionGateway } from "./interaction-gateway";

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

test("pointer gateway treats mouse, touch, and pen compatibility activation as one pointer", () => {
  const selected: string[] = [];
  const gateway = createInteractionGateway({ onMarkerActivate: (id) => selected.push(id) });
  gateway.pointerDown(4);
  gateway.pointerUp(4, "facility-3", "pointer-4", "touch");
  gateway.dispatch({ type: "marker", itemId: "facility-3", activationId: "pointer-4", modality: "mouse" });
  gateway.dispatch({ type: "marker", itemId: "facility-3", activationId: "pointer-4", modality: "pen" });
  assert.deepEqual(selected, ["facility-3"]);
});
