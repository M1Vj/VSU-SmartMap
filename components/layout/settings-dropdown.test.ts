import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./settings-dropdown.tsx", import.meta.url),
  "utf8",
);

test("mobile settings render navigation tab controls inline instead of in a clipped submenu", () => {
  assert.match(source, /MOBILE_SETTINGS_QUERY = "\(max-width: 767px\)"/);
  assert.match(source, /isCompactSettings/);
  assert.match(source, /isCompactSettings \? \(/);
  assert.match(source, /<NavigationTabItems/);
  assert.match(source, /<DropdownMenuSub>/);
});
