import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Option A splits status from a safe-area action dock and lifts both facility and boarding cards", async () => {
  const pageSource = await readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8");
  const cardSource = await readFile(new URL("../../components/map/map-bottom-card.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /data-map-status-hud/);
  assert.match(pageSource, /data-map-action-dock/);
  assert.match(pageSource, /fixed inset-x-0 bottom-\[calc\(7\.25rem\+min\(42vh,22rem\)\+env\(safe-area-inset-bottom,0px\)\)\]/);
  const statusStart = pageSource.indexOf("<div data-map-status-hud");
  const actionStart = pageSource.indexOf("<div data-map-action-dock");
  assert.ok(statusStart >= 0 && actionStart > statusStart);
  assert.match(pageSource.slice(statusStart, actionStart), /aria-label="Use my location as route start"/);
  assert.match(pageSource.slice(statusStart, actionStart), /aria-label="Start route from main gate"/);
  assert.match(pageSource, /data-map-action-dock[\s\S]{0,1800}aria-label=\{`\$\{navigationControls\.primaryActionLabel\} navigation`\}/);
  assert.doesNotMatch(pageSource.slice(actionStart), /Use my location as route start/);
  assert.doesNotMatch(pageSource.slice(actionStart), /Start route from main gate/);
  assert.match(pageSource, /data-map-action-dock[\s\S]{0,2400}aria-label="Report route"/);
  assert.equal((pageSource.match(/className="h-11/g) ?? []).length >= 4, true);
  const dockSource = pageSource.slice(actionStart);
  assert.equal((dockSource.match(/className="h-11/g) ?? []).length >= 2, true);
  assert.match(cardSource, /bottom-\[calc\(7\.25rem\+env\(safe-area-inset-bottom,0px\)\)\]/);
  assert.match(cardSource, /role="dialog"/);
});

test("marker adapter forwards pointer identity/modality before Leaflet click compatibility", async () => {
  const markerSource = await readFile(new URL("../../components/map/map-marker.tsx", import.meta.url), "utf8");
  assert.match(markerSource, /addEventListener\("pointerdown"/);
  assert.match(markerSource, /addEventListener\("pointerup"/);
  assert.match(markerSource, /pointerId/);
  assert.match(markerSource, /pointerType/);
  assert.match(markerSource, /compatibilityActivationRef/);
});
