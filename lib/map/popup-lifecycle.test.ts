import assert from "node:assert/strict";
import test from "node:test";

import {
  createMarkerPopupLifecycleController,
  shouldHandleMapSelectionEscape,
} from "./popup-lifecycle.ts";

test("keyboard popup opens request focus while pointer popup does not", async () => {
  const keyboard = createMarkerPopupLifecycleController();
  let keyboardFocusRequests = 0;
  keyboard.selectionChanged(true);
  keyboard.opened("keyboard", () => {
    keyboardFocusRequests += 1;
  });

  const pointer = createMarkerPopupLifecycleController();
  let pointerFocusRequests = 0;
  pointer.selectionChanged(true);
  pointer.opened("touch", () => {
    pointerFocusRequests += 1;
  });

  await new Promise<void>((resolve) => queueMicrotask(resolve));

  assert.equal(keyboardFocusRequests, 1);
  assert.equal(pointerFocusRequests, 0);
});

test("duplicate close and Escape callbacks consume one selected-open token", () => {
  const lifecycle = createMarkerPopupLifecycleController();
  const effects = { closed: 0, deselected: 0, restored: 0 };
  lifecycle.selectionChanged(true);
  lifecycle.opened("keyboard", () => undefined);

  const closeEffects = {
    closePopup: () => {
      effects.closed += 1;
    },
    onDeselect: () => {
      effects.deselected += 1;
    },
    restoreMarkerFocus: () => {
      effects.restored += 1;
    },
  };

  assert.equal(lifecycle.close("dismiss", closeEffects), true);
  assert.equal(lifecycle.close("dismiss", closeEffects), false);
  assert.deepEqual(effects, { closed: 1, deselected: 1, restored: 1 });
});

test("keyboard dismiss requests marker focus only after deselection", () => {
  const lifecycle = createMarkerPopupLifecycleController();
  const events: string[] = [];
  lifecycle.selectionChanged(true);
  lifecycle.opened("keyboard", () => undefined);

  assert.equal(
    lifecycle.close("dismiss", {
      closePopup: () => events.push("close"),
      onDeselect: () => events.push("deselect"),
      restoreMarkerFocus: () => events.push("restore-request"),
    }),
    true,
  );
  assert.deepEqual(events, ["close", "deselect", "restore-request"]);
});

test("Details closes once without turning an action into a selection clear", () => {
  const lifecycle = createMarkerPopupLifecycleController();
  let closeCount = 0;
  let deselectCount = 0;
  lifecycle.selectionChanged(true);
  lifecycle.opened("touch", () => undefined);

  const effects = {
    closePopup: () => {
      closeCount += 1;
    },
    onDeselect: () => {
      deselectCount += 1;
    },
  };

  assert.equal(lifecycle.close("action", effects), true);
  assert.equal(lifecycle.close("action", effects), false);
  assert.equal(closeCount, 1);
  assert.equal(deselectCount, 0);
});

test("a selected marker can reopen a fresh popup token after an action close", () => {
  const lifecycle = createMarkerPopupLifecycleController();
  let closes = 0;
  lifecycle.selectionChanged(true);
  lifecycle.opened("touch", () => undefined);
  assert.equal(
    lifecycle.close("action", { closePopup: () => { closes += 1; } }),
    true,
  );

  lifecycle.opened("touch", () => undefined);
  assert.equal(
    lifecycle.close("dismiss", { closePopup: () => { closes += 1; } }),
    true,
  );
  assert.equal(closes, 2);
});

test("an accepted Navigate closes once and the selected marker can reopen", () => {
  const lifecycle = createMarkerPopupLifecycleController();
  let closes = 0;
  lifecycle.selectionChanged(true);
  lifecycle.opened("touch", () => undefined);

  assert.equal(
    lifecycle.navigate(
      () => 9,
      { closePopup: () => { closes += 1; } },
    ),
    9,
  );

  lifecycle.opened("touch", () => undefined);
  assert.equal(
    lifecycle.close("dismiss", { closePopup: () => { closes += 1; } }),
    true,
  );
  assert.equal(closes, 2);
});

test("duplicate popupopen callbacks do not duplicate keyboard focus requests", async () => {
  const lifecycle = createMarkerPopupLifecycleController();
  let focusRequests = 0;
  lifecycle.selectionChanged(true);
  lifecycle.opened("keyboard", () => { focusRequests += 1; });
  lifecycle.opened("keyboard", () => { focusRequests += 1; });

  await new Promise<void>((resolve) => queueMicrotask(resolve));
  assert.equal(focusRequests, 1);
});

test("pointer-origin popup dismissal never requests marker focus", () => {
  const lifecycle = createMarkerPopupLifecycleController();
  let restored = 0;
  lifecycle.selectionChanged(true);
  lifecycle.opened("touch", () => undefined);

  lifecycle.close("dismiss", {
    closePopup: () => undefined,
    restoreMarkerFocus: () => { restored += 1; },
  });

  assert.equal(restored, 0);
});

test("closing before the keyboard focus frame cancels the focus request", async () => {
  const lifecycle = createMarkerPopupLifecycleController();
  let focusRequests = 0;
  lifecycle.selectionChanged(true);
  lifecycle.opened("keyboard", () => { focusRequests += 1; });
  lifecycle.close("dismiss", { closePopup: () => undefined });

  await new Promise<void>((resolve) => queueMicrotask(resolve));
  assert.equal(focusRequests, 0);
});

test("default-prevented Escape never becomes a document selection clear", () => {
  assert.equal(shouldHandleMapSelectionEscape({ key: "Escape", defaultPrevented: false }), true);
  assert.equal(shouldHandleMapSelectionEscape({ key: "Escape", defaultPrevented: true }), false);
  assert.equal(shouldHandleMapSelectionEscape({ key: "Enter", defaultPrevented: false }), false);
});

test("selection transfer closes A without deselecting or clearing the map", () => {
  const lifecycleA = createMarkerPopupLifecycleController();
  const lifecycleB = createMarkerPopupLifecycleController();
  const events: string[] = [];
  lifecycleA.selectionChanged(true);
  lifecycleA.opened("touch", () => undefined);
  lifecycleB.selectionChanged(true);
  lifecycleB.opened("touch", () => undefined);

  assert.equal(
    lifecycleA.close("selection-transfer", {
      closePopup: () => events.push("A-close"),
      onDeselect: () => events.push("background-clear"),
    }),
    true,
  );
  lifecycleA.selectionChanged(false);
  events.push("B-open");

  assert.deepEqual(events, ["A-close", "B-open"]);
});

test("Navigate keeps a rejected popup open and permits a later retry", async () => {
  const lifecycle = createMarkerPopupLifecycleController();
  const events: string[] = [];
  let attempts = 0;
  lifecycle.selectionChanged(true);
  lifecycle.opened("touch", () => undefined);

  assert.equal(
    lifecycle.navigate(
      () => {
        attempts += 1;
        return null;
      },
      {
        closePopup: () => events.push("close"),
      },
    ),
    null,
  );
  assert.equal(attempts, 1);
  assert.equal(events.length, 0);

  await new Promise<void>((resolve) => queueMicrotask(resolve));

  assert.equal(
    lifecycle.navigate(
      () => {
        attempts += 1;
        return 42;
      },
      {
        closePopup: () => events.push("close"),
      },
    ),
    42,
  );
  assert.equal(attempts, 2);
  assert.deepEqual(events, ["close"]);
});

test("Navigate gates duplicate compatibility callbacks before invoking the parent", () => {
  const lifecycle = createMarkerPopupLifecycleController();
  const events: string[] = [];
  let parentCalls = 0;
  lifecycle.selectionChanged(true);
  lifecycle.opened("mouse", () => undefined);

  const action = () => {
    parentCalls += 1;
    return 7;
  };
  const effects = {
    closePopup: () => events.push("close"),
  };

  assert.equal(lifecycle.navigate(action, effects), 7);
  assert.equal(lifecycle.navigate(action, effects), null);
  assert.equal(parentCalls, 1);
  assert.deepEqual(events, ["close"]);
});
