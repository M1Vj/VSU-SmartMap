import { test, expect, type Page } from "@playwright/test";

const baseUrl = process.env.MAP_E2E_BASE_URL ?? "http://127.0.0.1:3000";
const mobileViewport = { width: 390, height: 844 };

async function openMap(page: Page) {
  await page.goto("/", { waitUntil: "commit" });
  await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".leaflet-control-zoom")).toBeVisible({ timeout: 15_000 });
}

async function firstMarker(page: Page) {
  const markers = page.locator(".leaflet-marker-icon[data-map-item-id]");
  await expect
    .poll(() => markers.count(), { timeout: 15_000 })
    .toBeGreaterThan(0);
  return markers.first();
}

async function markerCenter(page: Page, marker: ReturnType<Page["locator"]>) {
  const box = await marker.boundingBox();
  if (!box) throw new Error("marker is not visible");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe("Broad map interaction smoke", () => {
  test("keeps controls, individual dots, and map interactions working in one session", async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await openMap(page);

    await expect(page.locator(".leaflet-control-zoom-in")).toBeVisible();
    await expect(page.locator(".leaflet-control-zoom-out")).toBeVisible();
    const marker = await firstMarker(page);
    await expect(marker).toBeVisible();

    const before = await markerCenter(page, marker);
    const map = page.locator(".leaflet-container");
    const mapBox = await map.boundingBox();
    if (!mapBox) throw new Error("map is not visible");

    await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(mapBox.x + mapBox.width / 2 + 80, mapBox.y + mapBox.height / 2 + 24, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(120);

    const after = await markerCenter(page, marker);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(20);

    const beforeWheel = await markerCenter(page, marker);
    await map.hover();
    await page.mouse.wheel(0, -180);

    await expect.poll(
      async () => {
        const afterWheel = await markerCenter(page, marker);
        return Math.hypot(afterWheel.x - beforeWheel.x, afterWheel.y - beforeWheel.y);
      },
      { timeout: 3_000 },
    ).toBeGreaterThan(2);
    await expect(page.locator(".leaflet-marker-icon[data-map-item-id]").first()).toBeVisible();

    await marker.click();
    const popup = page.locator('[data-map-control="marker-popup"]');
    await expect(popup).toBeVisible();
    await expect(popup.locator('[data-map-popup-first-control="true"]')).toBeVisible();
    await expect(popup.locator('[data-map-popup-action="true"]')).toHaveCount(2);

    const markerBox = await marker.boundingBox();
    const tipBox = await page.locator(".leaflet-popup-tip").boundingBox();
    if (!markerBox || !tipBox) throw new Error("popup anchor is not visible");
    const markerX = markerBox.x + markerBox.width / 2;
    const markerY = markerBox.y + markerBox.height / 2;
    const tipX = tipBox.x + tipBox.width / 2;
    const tipY = tipBox.y + tipBox.height / 2;
    expect(Math.hypot(markerX - tipX, markerY - tipY)).toBeLessThan(120);
  });
});