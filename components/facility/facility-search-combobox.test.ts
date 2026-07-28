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

test("shared facility combobox preserves keyboard, pointer, and dynamic result behavior", async () => {
  const source = await readFile(
    new URL("./facility-search-combobox.tsx", import.meta.url),
    "utf8",
  );

  for (const required of [
    "suppressResults",
    "current >= renderedCount ? renderedCount - 1 : current",
    "(current + 1) % renderedCount",
    "current <= 0 ? renderedCount - 1 : current - 1",
    "onMouseDown={(event) => event.preventDefault()}",
    "recents = []",
    "loading || unavailable || (!loading && options.length === 0)",
    'role="status"',
    "aria-selected={selectedFacilityId === option.facility.id}",
  ]) {
    assert.match(
      source,
      new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
});

test("AppHeader wires selection and TBA suppression into the shared combobox", async () => {
  const source = await readFile(new URL("../app-header.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /selectedFacilityId=\{selectedFacility\?\.id \?\? pendingFacilityId \?\? undefined\}/,
  );
  assert.match(source, /suppressResults=\{isTbaQuery\}/);
});
