import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MyLocationButton } from "./my-location-button";

test("My Location keeps the familiar compact square inside a 44px hit target", () => {
  const markup = renderToStaticMarkup(
    <MyLocationButton
      isTracking={false}
      hasHeading={false}
      onLocate={() => undefined}
    />,
  );

  assert.match(markup, /data-map-control="my-location"/);
  assert.match(markup, /h-11 w-11/);
  assert.match(markup, /h-\[30px\] w-\[30px\]/);
  assert.match(markup, /rounded-sm/);
  assert.doesNotMatch(markup, /left-\[12px\]|bottom-\[/);
});
