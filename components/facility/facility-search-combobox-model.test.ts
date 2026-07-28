import assert from "node:assert/strict";
import test from "node:test";
import {
  getFacilityComboboxKeyAction,
  getFacilityComboboxRenderState,
} from "./facility-search-combobox-model.ts";

test("facility options stay hidden and unselectable until the controlled query settles", () => {
  const stale = getFacilityComboboxRenderState({
    query: "library",
    optionsQuery: "admin",
    optionCount: 4,
    recentCount: 0,
    focused: true,
    open: true,
    loading: false,
    unavailable: false,
    suppressResults: false,
  });

  assert.equal(stale.renderFacilityOptions, false);
  assert.equal(stale.renderedCount, 0);
  assert.equal(stale.shouldRenderListbox, false);
  assert.equal(
    getFacilityComboboxKeyAction("Enter", -1, stale.renderedCount).selectIndex,
    null,
  );
});

test("blank queries without recents never expose stale facility options to Enter", () => {
  const blank = getFacilityComboboxRenderState({
    query: "  ",
    optionsQuery: "admin",
    optionCount: 4,
    recentCount: 0,
    focused: true,
    open: true,
    loading: false,
    unavailable: false,
    suppressResults: false,
  });

  assert.equal(blank.renderedCount, 0);
  assert.equal(blank.shouldRenderListbox, false);
  assert.equal(
    getFacilityComboboxKeyAction("Enter", 2, blank.renderedCount).selectIndex,
    null,
  );
});

test("keyboard actions wrap, select the first option, and close on Escape", () => {
  assert.deepEqual(getFacilityComboboxKeyAction("ArrowDown", 2, 3), {
    preventDefault: true,
    stopPropagation: false,
    open: true,
    highlightedIndex: 0,
    selectIndex: null,
  });
  assert.equal(
    getFacilityComboboxKeyAction("ArrowUp", 0, 3).highlightedIndex,
    2,
  );
  assert.equal(
    getFacilityComboboxKeyAction("Enter", -1, 3).selectIndex,
    0,
  );
  assert.deepEqual(getFacilityComboboxKeyAction("Escape", 1, 3, true), {
    preventDefault: true,
    stopPropagation: true,
    open: false,
    highlightedIndex: -1,
    selectIndex: null,
  });
  assert.deepEqual(getFacilityComboboxKeyAction("Escape", 1, 3, false), {
    preventDefault: false,
    stopPropagation: false,
    open: false,
    highlightedIndex: -1,
    selectIndex: null,
  });
});

test("suppression synchronously removes recents, options, and statuses", () => {
  const suppressed = getFacilityComboboxRenderState({
    query: "",
    optionsQuery: "",
    optionCount: 3,
    recentCount: 2,
    focused: true,
    open: true,
    loading: true,
    unavailable: true,
    suppressResults: true,
  });

  assert.deepEqual(suppressed, {
    showRecents: false,
    renderFacilityOptions: false,
    renderedCount: 0,
    showStatus: false,
    shouldRenderListbox: false,
  });
});

test("settled options and loading or unavailable states render the matching branch", () => {
  const settled = getFacilityComboboxRenderState({
    query: "  LIBRARY ",
    optionsQuery: "library",
    optionCount: 2,
    recentCount: 0,
    focused: true,
    open: true,
    loading: false,
    unavailable: false,
    suppressResults: false,
  });
  assert.equal(settled.renderFacilityOptions, true);
  assert.equal(settled.renderedCount, 2);
  assert.equal(settled.shouldRenderListbox, true);

  for (const state of [
    { loading: true, unavailable: false, optionsQuery: "old" },
    { loading: false, unavailable: true, optionsQuery: "library" },
  ]) {
    assert.equal(
      getFacilityComboboxRenderState({
        query: "library",
        optionCount: 0,
        recentCount: 0,
        focused: true,
        open: true,
        suppressResults: false,
        ...state,
      }).showStatus,
      true,
    );
  }
});
