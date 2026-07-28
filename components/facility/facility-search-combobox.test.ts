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
    "onMouseDown={(event) => event.preventDefault()}",
    "recents = []",
    'role="status"',
    "aria-selected={selectedFacilityId === option.facility.id}",
    "aria-selected={selectedFacilityId === recent.id}",
    "tabIndex={-1}",
    'document.addEventListener("pointerdown", handlePointerDown)',
    "onClick={onClearRecents}",
    "id={listboxId}",
  ]) {
    assert.match(
      source,
      new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }

  assert.doesNotMatch(source, /aria-selected=\{highlightedIndex === index\}/);
  assert.match(source, /\{showRecents && onClearRecents && \(/);
  assert.match(
    source,
    /showRecents && onClearRecents[\s\S]*?<button[\s\S]*?tabIndex=\{-1\}[\s\S]*?Clear history/,
  );
  assert.match(source, /role="listbox"[\s\S]*\{showRecents[\s\S]*recents\.map/);
  assert.doesNotMatch(
    source,
    /role="listbox"[\s\S]*Clear history[\s\S]*recents\.map/,
  );
});

test("AppHeader wires selection and TBA suppression into the shared combobox", async () => {
  const source = await readFile(new URL("../app-header.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /selectedFacilityId=\{selectedFacility\?\.id \?\? pendingFacilityId \?\? undefined\}/,
  );
  assert.match(source, /suppressResults=\{isTbaQuery\}/);
  assert.match(source, /optionsQuery=\{debouncedQuery\}/);
});

test("schedule dialog exposes real loading and unavailable combobox states once", async () => {
  const source = await readFile(
    new URL("../schedule/course-dialog.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /loading=\{facilitiesLoading\}/);
  assert.match(
    source,
    /unavailable=\{\s*Boolean\(facilitiesError\) && facilities\.length === 0\s*\}/,
  );
  assert.match(
    source,
    /unavailableMessage="Facility search is unavailable\. Try again online or choose Other location\."/,
  );
  assert.doesNotMatch(source, /suppressResults=\{\s*Boolean\(facilitiesError\)/);
});
