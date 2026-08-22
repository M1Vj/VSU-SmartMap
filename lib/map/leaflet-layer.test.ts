import assert from "node:assert/strict";
import test from "node:test";
import type { Map as LeafletMap } from "leaflet";

import { addLayerToMap } from "./leaflet-layer.ts";

test("attaches tile handlers before addTo so synchronous tileerror is observed", () => {
  let tileErrorCount = 0;
  let handlersAttached = false;
  let added = false;

  const layer = {
    on(handlers: { tileerror?: () => void }) {
      handlersAttached = true;
      this.handlers = handlers;
      return this;
    },
    addTo() {
      added = true;
      assert.equal(handlersAttached, true);
      this.handlers?.tileerror?.();
      return this;
    },
    handlers: undefined as { tileerror?: () => void } | undefined,
  };

  const returnedLayer = addLayerToMap(layer, {} as LeafletMap, {
    tileerror: () => {
      tileErrorCount += 1;
    },
  });

  assert.equal(returnedLayer, layer);
  assert.equal(added, true);
  assert.equal(tileErrorCount, 1);
});
