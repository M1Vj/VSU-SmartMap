import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  handleMapPopupKeyDown,
  MapMarkerPopupShell,
} from "./map-marker-popup-shell";

test("renders a labelled non-modal popup shell with a reachable close control", () => {
  const markup = renderToStaticMarkup(
    <MapMarkerPopupShell label="DASS" onClose={() => undefined}>
      <p>Quick actions</p>
    </MapMarkerPopupShell>,
  );

  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-modal="false"/);
  assert.match(markup, /aria-label="DASS quick actions"/);
  assert.match(markup, /type="button"/);
  assert.match(markup, /aria-label="Close DASS popup"/);
  assert.match(markup, /data-map-popup-first-control="true"/);
  assert.match(markup, /h-11 w-11/);
  assert.match(markup, /max-h-\[min\(60dvh,calc\(100dvh-376px\),22rem\)\]/);
  assert.match(markup, /overflow-y-auto/);
  assert.ok(568 - 376 >= 192);
});

test("Escape is owned by the popup while other keys pass through", () => {
  let prevented = 0;
  let stopped = 0;
  let closed = 0;
  const escapeEvent = {
    key: "Escape",
    preventDefault: () => {
      prevented += 1;
    },
    stopPropagation: () => {
      stopped += 1;
    },
  };

  handleMapPopupKeyDown(escapeEvent, () => {
    closed += 1;
  });
  assert.deepEqual({ prevented, stopped, closed }, { prevented: 1, stopped: 1, closed: 1 });

  handleMapPopupKeyDown(
    {
      key: "Enter",
      preventDefault: () => {
        prevented += 1;
      },
      stopPropagation: () => {
        stopped += 1;
      },
    },
    () => {
      closed += 1;
    },
  );
  assert.deepEqual({ prevented, stopped, closed }, { prevented: 1, stopped: 1, closed: 1 });
});
