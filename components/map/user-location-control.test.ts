import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the My Location button remains the explicit map camera action", async () => {
  const source = await readFile(
    new URL("./user-location-control.tsx", import.meta.url),
    "utf8",
  );
  const handleLocate = source.slice(
    source.indexOf("const handleLocate"),
    source.indexOf("const handlePermissionConfirm"),
  );

  assert.match(source, /onLocate=\{handleLocate\}/);
  assert.match(handleLocate, /map\.flyTo\(/);
  assert.match(handleLocate, /map\.fitBounds\(/);
});
