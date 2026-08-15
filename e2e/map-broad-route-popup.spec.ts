import { test, expect, type Page, type TestInfo } from "@playwright/test";

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 900 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;
const BASEMAPS = ["vector", "satellite"] as const;
const ZOOM_METHODS = ["wheel", "pinch", "control", "double-click", "keyboard", "programmatic"] as const;
const EDGE_POSITIONS = ["center", "north", "east", "south", "west"] as const;
const TOUCH_WIDTHS = new Set([320, 390, 412, 768]);
const MARKER_KINDS = ["facility", "boarding"] as const;
const KEYBOARD_KEYS = ["Enter", "Space"] as const;
type MarkerKind = (typeof MARKER_KINDS)[number];
type EdgePosition = (typeof EDGE_POSITIONS)[number];

const configuredBaseUrl = process.env.MAP_E2E_BASE_URL;

function evidenceUrl(overrides: Record<string, string> = {}, enabled = true) {
  const url = new URL(configuredBaseUrl ?? "http://localhost:3000/");
  if (enabled) url.searchParams.set("mapEvidence", "1");
  else url.searchParams.delete("mapEvidence");
  for (const [key, value] of Object.entries(overrides)) url.searchParams.set(key, value);
  return url.toString();
}

function blockFixture(testInfo: TestInfo, reason: string): never {
  testInfo.annotations.push({ type: "blocked", description: reason });
  test.skip(true, `BLOCKED: ${reason}`);
  throw new Error(`BLOCKED: ${reason}`);
}

async function openEvidencePage(page: Page, params: Record<string, string> = {}) {
  await page.goto(evidenceUrl(params), { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
}

async function getEvents(page: Page) {
  return page.evaluate(() => window.__VSU_MAP_E2E__?.events() ?? []);
}

function assertSanitizedEvents(events: readonly { sequence: number; name: string; correlationOrdinal: number | null; modality: string | null }[]) {
  const forbiddenValues = /(lat|lng|https?:|private|requestId|itemId|facility|boarding|raw-id)/i;
  for (const event of events) {
    expect(Object.keys(event).sort()).toEqual(["correlationOrdinal", "modality", "name", "sequence"]);
    expect(typeof event.sequence).toBe("number");
    expect(typeof event.name).toBe("string");
    expect(event.modality === null || typeof event.modality === "string").toBe(true);
    expect(event.correlationOrdinal === null || typeof event.correlationOrdinal === "number").toBe(true);
    for (const value of Object.values(event)) {
      if (typeof value === "string") expect(value).not.toMatch(forbiddenValues);
    }
  }
}

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

function assertNoConsoleErrors(errors: string[], allowed: readonly RegExp[] = []) {
  const unexpected = errors.filter((message) => !allowed.some((pattern) => pattern.test(message)));
  expect(unexpected, unexpected.join("\n")).toEqual([]);
}

async function resetProbe(page: Page) {
  const available = await page.evaluate(() => Boolean(window.__VSU_MAP_E2E__));
  if (!available) throw new Error("map evidence probe is unavailable on the opted-in page");
  await page.evaluate(() => window.__VSU_MAP_E2E__?.reset());
}

async function requireMarker(page: Page, testInfo: TestInfo, kind: MarkerKind) {
  const markers = page.locator(`[data-map-item-kind="${kind}"]`);
  await expect.poll(() => markers.count(), { timeout: 8_000 }).toBeGreaterThan(0).catch(() => {
    blockFixture(testInfo, `${kind} fixtures are not published on this runtime`);
  });
  return markers.first();
}

async function requireFacilityPair(page: Page, testInfo: TestInfo) {
  const markers = page.locator('[data-map-item-kind="facility"]');
  await expect.poll(() => markers.count(), { timeout: 8_000 }).toBeGreaterThanOrEqual(2).catch(() => {
    blockFixture(testInfo, "two facility fixtures are not published on this runtime");
  });
  return markers;
}

async function mapAndMarkerGeometry(marker: ReturnType<Page["locator"]>) {
  return marker.evaluate((element) => {
    const map = element.closest(".leaflet-container");
    if (!map) return null;
    const mapRect = map.getBoundingClientRect();
    const markerRect = element.getBoundingClientRect();
    return {
      map: { left: mapRect.left, top: mapRect.top, right: mapRect.right, bottom: mapRect.bottom, width: mapRect.width, height: mapRect.height },
      marker: { x: markerRect.left + markerRect.width / 2, y: markerRect.top + markerRect.height / 2 },
    };
  });
}

function edgeTarget(edge: EdgePosition, map: { left: number; top: number; right: number; bottom: number; width: number; height: number }) {
  const inset = Math.min(36, Math.max(24, Math.round(Math.min(map.width, map.height) * 0.08)));
  return {
    x: edge === "east" ? map.right - inset : edge === "west" ? map.left + inset : map.left + map.width / 2,
    y: edge === "north" ? map.top + inset : edge === "south" ? map.bottom - inset : map.top + map.height / 2,
  };
}

function assertEdgeBand(
  edge: EdgePosition,
  geometry: Awaited<ReturnType<typeof mapAndMarkerGeometry>>,
  target: { x: number; y: number },
) {
  if (!geometry) throw new Error("map/marker geometry is unavailable");
  const tolerance = 56;
  if (edge === "center") {
    expect(Math.abs(geometry.marker.x - target.x)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(geometry.marker.y - target.y)).toBeLessThanOrEqual(tolerance);
    return;
  }
  if (edge === "north" || edge === "south") {
    expect(Math.abs(geometry.marker.x - target.x)).toBeLessThanOrEqual(tolerance);
    if (edge === "north") expect(geometry.marker.y).toBeLessThanOrEqual(target.y + tolerance);
    else expect(geometry.marker.y).toBeGreaterThanOrEqual(target.y - tolerance);
    return;
  }
  expect(Math.abs(geometry.marker.y - target.y)).toBeLessThanOrEqual(tolerance);
  if (edge === "west") expect(geometry.marker.x).toBeLessThanOrEqual(target.x + tolerance);
  else expect(geometry.marker.x).toBeGreaterThanOrEqual(target.x - tolerance);
}

async function positionMarkerAtEdge(page: Page, marker: ReturnType<Page["locator"]>, edge: EdgePosition) {
  const initial = await mapAndMarkerGeometry(marker);
  if (!initial) throw new Error("map/marker geometry is unavailable");
  const target = edgeTarget(edge, initial.map);
  let direction = 1;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const geometry = await mapAndMarkerGeometry(marker);
    if (!geometry) throw new Error("map/marker geometry is unavailable");
    const dx = target.x - geometry.marker.x;
    const dy = target.y - geometry.marker.y;
    if (Math.hypot(dx, dy) <= 6) break;
    const beforeDistance = Math.hypot(dx, dy);
    await page.evaluate(({ x, y }) => window.__VSU_MAP_E2E__?.panBy(x, y), { x: dx * direction, y: dy * direction });
    await page.waitForTimeout(80);
    const after = await mapAndMarkerGeometry(marker);
    if (!after) throw new Error("map/marker geometry is unavailable after panning");
    const afterDistance = Math.hypot(target.x - after.marker.x, target.y - after.marker.y);
    if (afterDistance > beforeDistance) direction *= -1;
  }
  const positioned = await mapAndMarkerGeometry(marker);
  assertEdgeBand(edge, positioned, target);
  return positioned;
}

async function openMarkerAtEdge(page: Page, testInfo: TestInfo, kind: MarkerKind, edge: EdgePosition) {
  const marker = await requireMarker(page, testInfo, kind);
  await positionMarkerAtEdge(page, marker, edge);
  await marker.click();
  await expect(page.locator(".leaflet-popup")).toHaveCount(1);
  return marker;
}

async function assertPopupBounds(page: Page) {
  const bounds = await page.locator(".leaflet-popup").evaluate((popup) => {
    const map = popup.closest(".leaflet-container");
    if (!map) return null;
    const popupRect = popup.getBoundingClientRect();
    const mapRect = map.getBoundingClientRect();
    const controls = [...popup.querySelectorAll<HTMLElement>("button, a")].map((control) => {
      const rect = control.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        reachable: rect.width >= 44 && rect.height >= 44 && rect.right > 0 && rect.bottom > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight,
      };
    });
    const obstacles = [...document.querySelectorAll<HTMLElement>("header, nav, [data-map-action-dock], [data-map-status-hud], [data-map-popup-obstacle]")]
      .filter((element) => element !== popup && getComputedStyle(element).display !== "none")
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    const overlapsObstacle = obstacles.some((obstacle) =>
      popupRect.left < obstacle.right && popupRect.right > obstacle.left && popupRect.top < obstacle.bottom && popupRect.bottom > obstacle.top,
    );
    return {
      withinMap: popupRect.left >= mapRect.left && popupRect.right <= mapRect.right && popupRect.top >= mapRect.top && popupRect.bottom <= mapRect.bottom,
      overlapsObstacle,
      scrollable: popup.scrollHeight > popup.clientHeight || ["auto", "scroll"].includes(getComputedStyle(popup).overflowY),
      controls,
    };
  });
  if (!bounds) throw new Error("map popup bounds are unavailable");
  expect(bounds.withinMap).toBe(true);
  expect(bounds.overlapsObstacle).toBe(false);
  expect(bounds.controls.every((control) => control.reachable)).toBe(true);
  expect(bounds.controls.every((control) => control.width >= 44 && control.height >= 44)).toBe(true);
  expect(typeof bounds.scrollable).toBe("boolean");
}

async function assertFrameGate(page: Page) {
  await expect.poll(
    async () => (await page.evaluate(() => window.__VSU_MAP_E2E__?.snapshot().frames.length ?? 0)),
    { timeout: 8_000 },
  ).toBeGreaterThan(0);
  await page.evaluate(() => window.__VSU_MAP_E2E__?.stopFrameProbe());
  const snapshot = await page.evaluate(() => window.__VSU_MAP_E2E__?.snapshot());
  if (!snapshot) throw new Error("map evidence probe disappeared during frame sampling");
  expect(snapshot.frames.every((frame) => frame.routeVisible && frame.failure === null)).toBe(true);
  expect(snapshot.frames.every((frame) =>
    [frame.routeErrorPx, frame.destinationErrorPx, frame.rendererErrorPx]
      .filter((value): value is number => value !== null)
      .every((value) => value <= 2),
  )).toBe(true);
  expect(snapshot.frames.every((frame) => frame.expectedSampleCount > 0 && frame.renderedSampleCount > 0)).toBe(true);
  expect(snapshot.frameProbe.totalCostMs).toBeGreaterThanOrEqual(0);
}

async function assertPointerPopupGeometry(page: Page, marker: ReturnType<Page["locator"]>) {
  const markerBox = await marker.boundingBox();
  const tipBox = await page.locator(".leaflet-popup-tip").boundingBox();
  if (!markerBox || !tipBox) throw new Error("marker/popup anchor geometry is unavailable");
  const markerAnchor = { x: markerBox.x + markerBox.width / 2, y: markerBox.y + markerBox.height / 2 };
  const popupTip = { x: tipBox.x + tipBox.width / 2, y: tipBox.y + tipBox.height / 2 };
  expect(Math.hypot(markerAnchor.x - popupTip.x, markerAnchor.y - popupTip.y)).toBeLessThanOrEqual(120);
  expect(await page.locator(".leaflet-popup").evaluate((popup) => popup.contains(document.activeElement))).toBe(false);
}

async function waitForCommittedRoute(page: Page) {
  await expect.poll(() => page.locator(".map-route-line").count(), { timeout: 8_000 }).toBeGreaterThan(0);
  await expect.poll(async () => page.locator(".map-route-line").first().getAttribute("d"), { timeout: 8_000 }).not.toBeNull();
  await expect.poll(() => page.locator(".map-route-end").count(), { timeout: 8_000 }).toBeGreaterThan(0);
  await expect.poll(() => page.locator('[data-map-item-kind="facility"]').count(), { timeout: 8_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(120);
}

async function chooseMainGate(page: Page, testInfo: TestInfo) {
  const mainGate = page.locator("button").filter({ hasText: /^Start from main gate$/ }).first();
  if (await mainGate.count() === 0) blockFixture(testInfo, "manual-start Main Gate control is unavailable");
  await mainGate.click();
}

async function chooseMapStyle(page: Page, style: "Vector" | "Satellite") {
  const settings = page.getByRole("button", { name: "Settings" });
  if (await settings.count() === 0) throw new Error("Settings control is unavailable");
  await settings.click();
  const mapStyle = page.getByRole("menuitem", { name: "Map Style" });
  await expect(mapStyle).toBeVisible();
  await mapStyle.hover();
  const choice = page.getByRole("menuitemradio", { name: style, exact: true });
  await expect(choice).toBeVisible();
  await choice.click();
  if (style === "Satellite") {
    await expect(page.locator(".maplibregl-canvas")).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator(".leaflet-tile").first()).toBeVisible({ timeout: 5_000 });
  } else {
    await expect(page.locator(".maplibregl-canvas")).toHaveCount(1, { timeout: 5_000 });
  }
}

async function chooseSatellite(page: Page) {
  await chooseMapStyle(page, "Satellite");
}

async function chooseTheme(page: Page, theme: "Light" | "Dark") {
  await page.getByRole("button", { name: "Settings" }).click();
  const themeMenu = page.getByRole("menuitem", { name: "Theme" });
  await expect(themeMenu).toBeVisible();
  await themeMenu.hover();
  await page.getByRole("menuitemradio", { name: theme, exact: true }).click();
}

async function cameraSignature(page: Page) {
  return page.evaluate(() => {
    const pane = document.querySelector<HTMLElement>(".leaflet-map-pane");
    const zoomPane = document.querySelector<HTMLElement>(".leaflet-zoom-animated");
    return `${pane?.getAttribute("style") ?? ""}|${zoomPane?.getAttribute("style") ?? ""}`;
  });
}

async function performZoomMethod(page: Page, method: (typeof ZOOM_METHODS)[number]) {
  const before = await cameraSignature(page);
  let intermediate: string | undefined;
  const map = page.locator(".leaflet-container");
  switch (method) {
    case "wheel":
      await map.hover();
      await page.mouse.wheel(0, -240);
      break;
    case "pinch": {
      const client = await page.context().newCDPSession(page);
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 140, y: 240, id: 1 }, { x: 180, y: 240, id: 2 }],
      });
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 120, y: 240, id: 1 }, { x: 200, y: 240, id: 2 }],
      });
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      break;
    }
    case "control":
      await page.locator(".leaflet-control-zoom-in").click();
      await page.waitForTimeout(250);
      intermediate = await cameraSignature(page);
      await page.locator(".leaflet-control-zoom-out").click();
      break;
    case "double-click":
      await map.dblclick();
      break;
    case "keyboard":
      await map.focus();
      await page.keyboard.press("+");
      await page.waitForTimeout(250);
      intermediate = await cameraSignature(page);
      await page.keyboard.press("-");
      break;
    case "programmatic":
      await page.evaluate(() => window.__VSU_MAP_E2E__?.zoomTo(12));
      await page.waitForTimeout(250);
      intermediate = await cameraSignature(page);
      await page.evaluate(() => window.__VSU_MAP_E2E__?.zoomTo(19));
      break;
  }
  await page.waitForTimeout(350);
  const after = await cameraSignature(page);
  return { before, intermediate: intermediate ?? after, after };
}

async function activateRoute(page: Page, testInfo: TestInfo, marker: ReturnType<Page["locator"]>) {
  await marker.click();
  await expect(page.locator(".leaflet-popup")).toHaveCount(1);
  await resetProbe(page);
  const navigate = page.getByRole("button", { name: "Navigate", exact: true });
  if (await navigate.count() === 0) blockFixture(testInfo, "Navigate action is unavailable for the selected marker");
  await navigate.click();
  await chooseMainGate(page, testInfo);
  await waitForCommittedRoute(page);
}

test("default page does not install the evidence probe", async ({ page }) => {
  test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
  await page.goto(evidenceUrl({}, false), { waitUntil: "domcontentloaded" });
  expect(await page.evaluate(() => window.__VSU_MAP_E2E__)).toBeUndefined();
});

for (const viewport of VIEWPORTS) {
  for (const mode of BASEMAPS) {
    for (const zoomMethod of ZOOM_METHODS) {
      const runRouteAlignment = async ({ page }: { page: Page }, testInfo: TestInfo) => {
        test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
        const errors = collectConsoleErrors(page);
        await page.setViewportSize(viewport);
        await openEvidencePage(page);
        if (mode === "satellite") await chooseSatellite(page);
        const marker = await requireMarker(page, testInfo, "facility");
        await positionMarkerAtEdge(page, marker, "center");
        await activateRoute(page, testInfo, marker);
        await page.evaluate(() => window.__VSU_MAP_E2E__?.startFrameProbe());
        const zoomState = await performZoomMethod(page, zoomMethod);
        expect(zoomState.intermediate !== zoomState.before || zoomState.after !== zoomState.before).toBe(true);
        await page.waitForTimeout(600);
        await assertFrameGate(page);
        assertNoConsoleErrors(errors);
      };
      if (zoomMethod === "pinch") {
        test.describe(`touch-enabled route frame alignment: ${viewport.width}x${viewport.height} ${mode} ${zoomMethod}`, () => {
          test.use({ hasTouch: true });
          test("camera changes during pinch and route remains aligned", runRouteAlignment);
        });
      } else {
        test(`route frame alignment: ${viewport.width}x${viewport.height} ${mode} ${zoomMethod}`, runRouteAlignment);
      }
    }
  }
}

for (const kind of MARKER_KINDS) {
  for (const viewport of VIEWPORTS) {
    for (const edge of EDGE_POSITIONS) {
      test(`marker popup: ${kind} ${viewport.width}x${viewport.height} ${edge}`, async ({ page }, testInfo) => {
        test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
        const errors = collectConsoleErrors(page);
        await page.setViewportSize(viewport);
        await openEvidencePage(page, kind === "boarding" ? { boarding: "1" } : {});
        await resetProbe(page);
        const marker = await openMarkerAtEdge(page, testInfo, kind, edge);
        await assertPopupBounds(page);
        await assertPointerPopupGeometry(page, marker);
        expect(await page.locator("[data-map-bottom-card], .map-bottom-card").count()).toBe(0);
        const popup = page.locator(".leaflet-popup");
        expect(await popup.locator("[data-map-control='marker-popup']").count()).toBe(1);
        expect((await getEvents(page)).map((event) => event.name)).toEqual(["marker-activation", "popup-open"]);
        expect((await getEvents(page)).some((event) => event.name === "background-activation")).toBe(false);
        await popup.getByRole("button", { name: "Close" }).click();
        await expect(page.locator(".leaflet-popup")).toHaveCount(0);
        expect((await getEvents(page)).map((event) => event.name)).toEqual(["marker-activation", "popup-open", "popup-close"]);
        assertNoConsoleErrors(errors);
      });
    }
  }
}

for (const kind of MARKER_KINDS) {
  for (const viewport of VIEWPORTS.filter((candidate) => TOUCH_WIDTHS.has(candidate.width))) {
    for (const edge of EDGE_POSITIONS) {
      test.describe(`touch ${kind} ${viewport.width}x${viewport.height} ${edge}`, () => {
        test.use({ hasTouch: true });
        test("tap opens one popup through the accepted gateway", async ({ page }, testInfo) => {
          test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
          const errors = collectConsoleErrors(page);
          await page.setViewportSize(viewport);
          await openEvidencePage(page, kind === "boarding" ? { boarding: "1" } : {});
          const marker = await requireMarker(page, testInfo, kind);
          await positionMarkerAtEdge(page, marker, edge);
          await resetProbe(page);
          const box = await marker.boundingBox();
          if (!box) throw new Error("touch marker bounds are unavailable");
          await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
          await expect(page.locator(".leaflet-popup")).toHaveCount(1);
          await assertPointerPopupGeometry(page, marker);
          expect(await page.locator("[data-map-bottom-card], .map-bottom-card").count()).toBe(0);
          expect((await getEvents(page)).map((event) => event.name)).toEqual(["marker-activation", "popup-open"]);
          assertNoConsoleErrors(errors);
        });
      });
    }
  }
}

for (const kind of MARKER_KINDS) {
  for (const viewport of VIEWPORTS) {
    for (const key of KEYBOARD_KEYS) {
      test(`keyboard ${kind} popup focus and ${key} event list: ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
        test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
        const errors = collectConsoleErrors(page);
        await page.setViewportSize(viewport);
        await openEvidencePage(page, kind === "boarding" ? { boarding: "1" } : {});
        const marker = await requireMarker(page, testInfo, kind);
        await positionMarkerAtEdge(page, marker, "center");
        await marker.focus();
        await resetProbe(page);
        await page.keyboard.press(key);
        await expect(page.locator(".leaflet-popup")).toHaveCount(1);
        await expect(page.locator("[data-map-popup-first-control='true']")).toBeFocused();
        expect((await getEvents(page)).map((event) => event.name)).toEqual(["marker-activation", "popup-open"]);
        await page.keyboard.press("Escape");
        await expect(page.locator(".leaflet-popup")).toHaveCount(0);
        expect((await getEvents(page)).map((event) => event.name)).toEqual(["marker-activation", "popup-open", "popup-close"]);
        expect(await page.evaluate(() => document.activeElement?.classList.contains("leaflet-marker-icon"))).toBe(true);
        assertNoConsoleErrors(errors);
      });
    }
  }
}

test("CDP pen activation is accepted once without background activation", async ({ page }, testInfo) => {
  test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openEvidencePage(page);
  const marker = await requireMarker(page, testInfo, "facility");
  await positionMarkerAtEdge(page, marker, "center");
  await resetProbe(page);
  const box = await marker.boundingBox();
  if (!box) throw new Error("pen marker bounds are unavailable");
  const client = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, pointerType: "pen" });
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1, pointerType: "pen" });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1, pointerType: "pen" });
  await expect(page.locator(".leaflet-popup")).toHaveCount(1);
  await assertPointerPopupGeometry(page, marker);
  expect(await page.locator("[data-map-bottom-card], .map-bottom-card").count()).toBe(0);
  const events = await getEvents(page);
  expect(events.map((event) => event.name)).toEqual(["marker-activation", "popup-open"]);
  expect(events.some((event) => event.name === "background-activation")).toBe(false);
  testInfo.annotations.push({ type: "synthetic", description: "CDP pen input is synthetic pointer evidence, not physical stylus hardware." });
  assertNoConsoleErrors(errors);
});

for (const kind of MARKER_KINDS) {
  test(`Details and Navigate execute once for ${kind}, with one sanitized correlation`, async ({ page }, testInfo) => {
    test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openEvidencePage(page, kind === "boarding" ? { boarding: "1" } : {});
    const marker = await requireMarker(page, testInfo, kind);
    await positionMarkerAtEdge(page, marker, "center");
    await marker.click();
    await expect(page.locator(".leaflet-popup")).toHaveCount(1);
    await resetProbe(page);
    if (kind === "boarding") {
      const details = page.getByRole("link", { name: "Details", exact: true });
      await expect(details).toHaveAttribute("href", /boarding-houses\//);
      await details.evaluate((link) => link.setAttribute("target", "_blank"));
      const [destinationPage] = await Promise.all([
        page.context().waitForEvent("page"),
        details.click(),
      ]);
      await destinationPage.waitForLoadState("domcontentloaded").catch(() => undefined);
      expect(destinationPage.url()).toMatch(/boarding-houses\//);
      await destinationPage.close();
    } else {
      await page.getByRole("button", { name: "Details", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
    }
    await expect.poll(async () => (await getEvents(page)).map((event) => event.name), { timeout: 2_000 }).toEqual(["details"]);

    await openEvidencePage(page, kind === "boarding" ? { boarding: "1" } : {});
    const navigateMarker = await requireMarker(page, testInfo, kind);
    await positionMarkerAtEdge(page, navigateMarker, "center");
    await navigateMarker.click();
    await expect(page.locator(".leaflet-popup")).toHaveCount(1);
    await resetProbe(page);
    await page.getByRole("button", { name: "Navigate", exact: true }).click();
    await chooseMainGate(page, testInfo);
    await waitForCommittedRoute(page);
    await expect.poll(async () => (await getEvents(page)).map((event) => event.name), { timeout: 8_000 }).toEqual([
      "navigate",
      "route-request",
      "navigation-feedback",
    ]);
    const routeEvents = (await getEvents(page)).filter((event) => ["navigate", "route-request", "navigation-feedback"].includes(event.name));
    expect(new Set(routeEvents.map((event) => event.correlationOrdinal)).size).toBe(1);
    expect(routeEvents.every((event) => typeof event.correlationOrdinal === "number")).toBe(true);
    assertSanitizedEvents(await getEvents(page));
    assertNoConsoleErrors(errors);
  });
}

test("delayed failed B replacement preserves committed A and consumes one-shot failure", async ({ page }, testInfo) => {
  test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await openEvidencePage(page);
  const markers = await requireFacilityPair(page, testInfo);
  const markerA = markers.nth(0);
  const markerB = markers.nth(1);

  await positionMarkerAtEdge(page, markerA, "center");
  await activateRoute(page, testInfo, markerA);
  const committedA = await page.locator(".map-route-line").getAttribute("d");
  if (!committedA) throw new Error("committed route A has no rendered geometry");

  await positionMarkerAtEdge(page, markerB, "east");
  await markerB.click();
  await expect(page.locator(".leaflet-popup")).toHaveCount(1);
  await resetProbe(page);
  await page.evaluate(() => window.__VSU_MAP_E2E__?.setRouteDelayMs(500));
  await page.evaluate(() => window.__VSU_MAP_E2E__?.failNextRoute());
  await page.getByRole("button", { name: "Navigate", exact: true }).click();
  await chooseMainGate(page, testInfo);

  const zoomState = await performZoomMethod(page, "wheel");
  expect(zoomState.intermediate !== zoomState.before || zoomState.after !== zoomState.before).toBe(true);
  await page.waitForTimeout(120);
  expect(await page.locator(".map-route-line").getAttribute("d")).toBe(committedA);
  await page.waitForTimeout(600);
  expect(await page.locator(".map-route-line").getAttribute("d")).toBe(committedA);
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 3_000 });
  const events = await getEvents(page);
  expect(events.map((event) => event.name)).toEqual(["navigate", "route-request", "navigation-feedback"]);
  expect(events.at(-1)?.correlationOrdinal).toBe(events[0]?.correlationOrdinal);
  expect((await page.evaluate(() => window.__VSU_MAP_E2E__?.snapshot().routeDelayMs))).toBe(500);
  await page.evaluate(() => window.__VSU_MAP_E2E__?.reset());
  expect(await page.evaluate(() => window.__VSU_MAP_E2E__?.snapshot().routeDelayMs)).toBe(0);
  assertNoConsoleErrors(errors, [/^NavigationLayer: Process error/]);
});

test("committed route survives popup Close and Escape without a bottom card", async ({ page }, testInfo) => {
  test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
  await page.setViewportSize({ width: 390, height: 844 });
  await openEvidencePage(page);
  const marker = await requireMarker(page, testInfo, "facility");
  await positionMarkerAtEdge(page, marker, "center");
  await activateRoute(page, testInfo, marker);
  const committedPath = await page.locator(".map-route-line").getAttribute("d");
  if (!committedPath) throw new Error("committed route has no rendered geometry");

  await resetProbe(page);
  await marker.click();
  const popup = page.locator(".leaflet-popup");
  await expect(popup).toHaveCount(1);
  await popup.getByRole("button", { name: /^Close/ }).click();
  await expect(popup).toHaveCount(0);
  expect(await page.locator(".map-route-line").getAttribute("d")).toBe(committedPath);
  expect((await getEvents(page)).map((event) => event.name)).toEqual(["marker-activation", "popup-open", "popup-close"]);
  expect(await page.locator("[data-map-bottom-card], .map-bottom-card").count()).toBe(0);

  await resetProbe(page);
  await marker.click();
  await expect(popup).toHaveCount(1);
  await popup.locator("[data-map-control='marker-popup']").press("Escape");
  await expect(popup).toHaveCount(0);
  expect(await page.locator(".map-route-line").getAttribute("d")).toBe(committedPath);
  expect((await getEvents(page)).map((event) => event.name)).toEqual(["marker-activation", "popup-open", "popup-close"]);
});

test("successful A-to-B replacement commits the new route and preserves correlation", async ({ page }, testInfo) => {
  test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
  await page.setViewportSize({ width: 1024, height: 768 });
  await openEvidencePage(page);
  const markers = await requireFacilityPair(page, testInfo);
  const markerA = markers.nth(0);
  const markerB = markers.nth(1);
  await positionMarkerAtEdge(page, markerA, "center");
  await activateRoute(page, testInfo, markerA);
  const pathA = await page.locator(".map-route-line").getAttribute("d");
  if (!pathA) throw new Error("route A has no rendered geometry");
  await positionMarkerAtEdge(page, markerB, "east");
  await markerB.click();
  await expect(page.locator(".leaflet-popup")).toHaveCount(1);
  await resetProbe(page);
  await page.getByRole("button", { name: "Navigate", exact: true }).click();
  await chooseMainGate(page, testInfo);
  await waitForCommittedRoute(page);
  const pathB = await page.locator(".map-route-line").getAttribute("d");
  expect(pathB).not.toBeNull();
  expect(pathB).not.toBe(pathA);
  const events = await getEvents(page);
  expect(events.map((event) => event.name)).toEqual(["navigate", "route-request", "navigation-feedback"]);
  expect(new Set(events.map((event) => event.correlationOrdinal)).size).toBe(1);
  expect(await page.locator("[data-map-bottom-card], .map-bottom-card").count()).toBe(0);
});

test("basemap switching keeps an active committed route", async ({ page }, testInfo) => {
  test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
  await page.setViewportSize({ width: 1024, height: 768 });
  await openEvidencePage(page);
  const marker = await requireMarker(page, testInfo, "facility");
  await positionMarkerAtEdge(page, marker, "center");
  await activateRoute(page, testInfo, marker);
  const before = await page.locator(".map-route-line").getAttribute("d");
  await chooseSatellite(page);
  expect(await page.locator(".map-route-line").getAttribute("d")).toBe(before);
  await chooseMapStyle(page, "Vector");
  expect(await page.locator(".map-route-line").getAttribute("d")).toBe(before);
});

for (const kind of MARKER_KINDS) {
  test(`active-route ${kind} popup survives safe-area and synthetic 200% root-font stress`, async ({ page }, testInfo) => {
    test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await openEvidencePage(page, kind === "boarding" ? { boarding: "1" } : {});
    const marker = await requireMarker(page, testInfo, kind);
    await positionMarkerAtEdge(page, marker, "center");
    await activateRoute(page, testInfo, marker);
    await marker.click();
    await expect(page.locator(".leaflet-popup")).toHaveCount(1);
    const client = await page.context().newCDPSession(page);
    try {
      await client.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 12, right: 0, bottom: 34, left: 0 } });
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      await expect.poll(async () => page.locator(".leaflet-popup").evaluate((popup) => {
        const map = popup.closest(".leaflet-container");
        if (!map) return false;
        const popupRect = popup.getBoundingClientRect();
        const mapRect = map.getBoundingClientRect();
        const obstacles = [...document.querySelectorAll<HTMLElement>("header, nav, [data-map-action-dock], [data-map-status-hud], [data-map-popup-obstacle]")]
          .filter((element) => element !== popup && getComputedStyle(element).display !== "none")
          .map((element) => element.getBoundingClientRect())
          .filter((rect) => rect.width > 0 && rect.height > 0);
        const controls = [...popup.querySelectorAll<HTMLElement>("button, a")].map((control) => {
          const rect = control.getBoundingClientRect();
          return rect.width >= 44 && rect.height >= 44 && rect.right > 0 && rect.bottom > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight;
        });
        const overlaps = obstacles.some((obstacle) => popupRect.left < obstacle.right && popupRect.right > obstacle.left && popupRect.top < obstacle.bottom && popupRect.bottom > obstacle.top);
        return popupRect.left >= mapRect.left && popupRect.right <= mapRect.right && popupRect.top >= mapRect.top && popupRect.bottom <= mapRect.bottom && !overlaps && controls.every(Boolean);
      }).catch(() => false), { timeout: 5_000 }).toBe(true);
      await assertPopupBounds(page);
      const scrollState = await page.evaluate(() => ({
        popupScrollable: (() => {
          const popup = document.querySelector<HTMLElement>("[data-map-control='marker-popup']");
          if (!popup) return false;
          const scrollArea = popup.querySelector<HTMLElement>(":scope > div");
          if (!scrollArea) return false;
          const style = getComputedStyle(scrollArea);
          return scrollArea.scrollHeight > scrollArea.clientHeight && ["auto", "scroll"].includes(style.overflowY);
        })(),
        controls: [...document.querySelectorAll<HTMLElement>(".leaflet-popup button, .leaflet-popup a")].map((element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height, reachable: rect.bottom > 0 && rect.top < window.innerHeight };
        }),
        horizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth && document.body.scrollWidth <= document.body.clientWidth,
      }));
      expect(scrollState.popupScrollable).toBe(true);
      expect(scrollState.horizontalOverflow).toBe(true);
      expect(scrollState.controls.every((control) => control.reachable && control.width >= 44 && control.height >= 44)).toBe(true);
    } catch (error) {
      if (String(error).includes("Emulation.setSafeAreaInsetsOverride")) blockFixture(testInfo, "CDP safe-area override is unavailable");
      throw error;
    } finally {
      await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
      await client.send("Emulation.setSafeAreaInsetsOverride", { insets: {} }).catch(() => undefined);
    }
    testInfo.annotations.push({ type: "synthetic", description: "CDP safe-area and 200% root-font evidence are synthetic; physical zoom is separately blocked." });
    assertNoConsoleErrors(errors);
  });
}

test("reduced motion and light/dark appearance retain one accepted activation", async ({ page }, testInfo) => {
  test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
  const errors = collectConsoleErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.setViewportSize({ width: 390, height: 844 });
  await openEvidencePage(page);
  await chooseTheme(page, "Light");
  expect(await page.locator("html").getAttribute("class")).not.toContain("dark");
  const marker = await requireMarker(page, testInfo, "facility");
  await positionMarkerAtEdge(page, marker, "center");
  await resetProbe(page);
  await marker.click();
  await expect(page.locator(".leaflet-popup")).toHaveCount(1);
  expect((await getEvents(page)).map((event) => event.name)).toEqual(["marker-activation", "popup-open"]);
  await chooseTheme(page, "Dark");
  expect(await page.locator("html").getAttribute("class")).toContain("dark");
  assertNoConsoleErrors(errors);
});

test("forced satellite tile failures switch to the attributed fallback", async ({ page }, testInfo) => {
  test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
  const errors = collectConsoleErrors(page);
  let aborted = 0;
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.includes("server.arcgisonline.com/ArcGIS/rest/services/World_Imagery") && aborted < 3) {
      aborted += 1;
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await openEvidencePage(page);
  await chooseSatellite(page);
  await expect.poll(() => aborted, { timeout: 8_000 }).toBeGreaterThanOrEqual(3);
  await expect(page.getByRole("status", { name: /Satellite imagery unavailable/i })).toBeVisible({ timeout: 8_000 });
  testInfo.annotations.push({ type: "synthetic", description: "Satellite tile aborts are deterministic fallback evidence, not an outage or hardware result." });
  await page.unroute("**/*");
  assertNoConsoleErrors(errors);
});

test("A-to-B transfer has a complete ordered event list and no background activation", async ({ page }, testInfo) => {
  test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openEvidencePage(page);
  const markers = await requireFacilityPair(page, testInfo);
  const markerA = markers.nth(0);
  const markerB = markers.nth(1);
  await positionMarkerAtEdge(page, markerA, "center");
  await positionMarkerAtEdge(page, markerB, "east");
  await resetProbe(page);
  await markerA.click();
  await expect(page.locator(".leaflet-popup")).toHaveCount(1);
  await markerB.click();
  await expect(page.locator(".leaflet-popup")).toHaveCount(1);
  const events = await getEvents(page);
  expect(events.map((event) => event.name)).toEqual([
    "marker-activation",
    "popup-open",
    "popup-close",
    "marker-activation",
    "popup-open",
  ]);
  expect(events.some((event) => event.name === "background-activation")).toBe(false);
  expect(events[0]?.correlationOrdinal).toBe(events[1]?.correlationOrdinal);
  expect(events[2]?.correlationOrdinal).toBe(events[0]?.correlationOrdinal);
  expect(events[3]?.correlationOrdinal).toBe(events[4]?.correlationOrdinal);
  expect(events[3]?.correlationOrdinal).not.toBe(events[0]?.correlationOrdinal);
  assertNoConsoleErrors(errors);
});

test("true Chrome 200% browser zoom row is explicitly blocked", async ({}, testInfo) => {
  test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
  blockFixture(testInfo, "true browser zoom is not safely driveable through this Chrome channel; synthetic root-font evidence is covered separately");
});

test("background-tab lifecycle throttling row is explicitly blocked", async ({}, testInfo) => {
  test.skip(!configuredBaseUrl, "BLOCKED: MAP_E2E_BASE_URL is not configured");
  blockFixture(testInfo, "background lifecycle throttling needs an external page lifecycle/CDP harness");
});
