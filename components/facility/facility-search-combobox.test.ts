import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared facility combobox exposes the complete ARIA contract", async () => {
  const source = await readFile(
    new URL("./facility-search-combobox.tsx", import.meta.url),
    "utf8",
  );
  for (const required of [
    'role="combobox"',
    'aria-autocomplete="list"',
    "aria-expanded",
    "aria-controls",
    "aria-activedescendant",
    'role="listbox"',
    'role="option"',
    "aria-selected",
    'role="status"',
    '"ArrowDown"',
    '"ArrowUp"',
    '"Enter"',
    '"Escape"',
  ]) {
    assert.match(
      source,
      new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
});
