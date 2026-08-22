import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MyLocationButton } from "./my-location-button";

test("My Location matches native control sizes across responsive pointers", () => {
  const markup = renderToStaticMarkup(
    <MyLocationButton
      isTracking={false}
      hasHeading={false}
      onLocate={() => undefined}
    />,
  );

  assert.match(markup, /data-map-control="my-location"/);
  assert.match(markup, /h-11 w-11/);
  assert.match(markup, /h-11 w-11 min-w-11/);
  assert.match(markup, /min-\[769px\]:h-\[30px\] min-\[769px\]:w-\[30px\] min-\[769px\]:min-w-\[30px\]/);
  assert.match(markup, /absolute bottom-0 left-0/);
  assert.match(markup, /rounded-sm/);
  assert.doesNotMatch(markup, /left-\[12px\]|bottom-\[/);
});
