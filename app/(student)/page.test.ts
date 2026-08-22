import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the student map warms the navigation chunk while online", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /const loadNavigationLayer = \(\) => import\("@\/components\/map\/navigation-layer"\)/,
  );
  assert.match(
    source,
    /const loadManualStartPin = \(\) => import\("@\/components\/map\/manual-start-pin"\)/,
  );
  assert.match(source, /void preloadNavigationLayer\(\)/);
});

test("navigation preload waits for service-worker readiness and control", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(source, /function waitForServiceWorkerControl/);
  assert.match(source, /await navigator\.serviceWorker\.ready/);
  assert.match(source, /addEventListener\("controllerchange"/);
  assert.doesNotMatch(source, /serviceWorker\.getRegistration/);
  assert.match(
    source,
    /waitForServiceWorkerControl\(\)[\s\S]*loadNavigationLayer\(\)/,
  );
  assert.match(
    source,
    /Promise\.all\(\[[\s\S]*loadNavigationLayer\(\)[\s\S]*loadManualStartPin\(\)/,
  );
  assert.match(source, /const NavigationLayer = dynamic\([\s\S]*loadNavigationLayer\(\)\.then/);
  assert.match(source, /const ManualStartPin = dynamic\([\s\S]*loadManualStartPin\(\)\.then/);
  assert.doesNotMatch(
    source,
    /const NavigationLayer = dynamic\([\s\S]*waitForServiceWorkerControl\(\)/,
  );
  assert.match(source, /preloadNavigationLayer[\s\S]*catch\(\(\) => undefined\)/);
});
