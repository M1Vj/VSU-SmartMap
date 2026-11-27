import { test, expect, errors, type Page } from "@playwright/test";

const baseUrl = process.env.MAP_E2E_BASE_URL;
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
  test.beforeAll(() => {
    if (!baseUrl) {
      throw new Error("MAP_E2E_BASE_URL must point to a running Broad map deployment");
    }
  });

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

test.describe("Directory filter smoke", () => {
  test("Clear filters restores the unfiltered facility count", async ({ page }) => {
    await page.goto("/directory");
    const count = page.getByText(/^Showing ([1-9]\d*) of \1 facilities$/);
    await expect(count).toBeVisible({ timeout: 15_000 });
    const baseline = await count.innerText();

    const search = page.getByRole("combobox", {
      name: "Search buildings or facilities",
      exact: true,
    });
    await page.goto("/directory?category=academic");
    await expect(page.getByRole("region", { name: "Academic", exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Filter directory categories: 1 selected", exact: true }),
    ).toBeVisible();
    const restrictedCount = page.getByText(/^Showing [1-9]\d* of [1-9]\d* facilities$/);
    await expect(restrictedCount).toBeVisible();
    await expect(restrictedCount).not.toHaveText(baseline);

    const noMatch = "zzzxxyy-no-campus-match";
    await search.fill(noMatch);
    await expect(page.getByText("No facilities match your filters.", { exact: true })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(noMatch);
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();

    const expectReset = async () => {
      await expect(search).toHaveValue("");
      await expect(
        page.getByRole("button", { name: "Filter directory categories: All categories", exact: true }),
      ).toBeVisible();
      await expect(count).toHaveText(baseline);
      await expect.poll(() => {
        const params = new URL(page.url()).searchParams;
        return { query: params.has("q"), category: params.has("category") };
      }).toEqual({ query: false, category: false });
    };
    await expectReset();
    await page.reload();
    await expectReset();

    await page.getByRole("button", {
      name: "Filter directory categories: All categories",
      exact: true,
    }).click();
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(page.getByRole("button", {
      name: "Filter directory categories: No categories",
      exact: true,
    })).toBeVisible();
    await expect(page.getByText("No facilities match your filters.", { exact: true })).toBeVisible();
  });
});

async function compositedPixels(page: Page, rgb: [number, number, number]) {
  // Screenshot the composited map; the GPU drawing buffer may already be clear.
  let capture: Buffer;
  try {
    capture = await page.locator(".leaflet-container").screenshot({ scale: "css", timeout: 2_000 });
  } catch (error) {
    // A transient compositor timeout should consume a poll, not the test budget.
    if (error instanceof errors.TimeoutError) return 0;
    throw error;
  }
  return page.evaluate(async ({ png, rgb: [red, green, blue] }) => {
    const bytes = Uint8Array.from(atob(png), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not decode the screenshot into a 2D canvas");
      ctx.drawImage(bitmap, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let matches = 0;
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (
          Math.abs(pixels[offset] - red) <= 10 &&
          Math.abs(pixels[offset + 1] - green) <= 10 &&
          Math.abs(pixels[offset + 2] - blue) <= 10
        ) matches++;
      }
      return matches;
    } finally {
      bitmap.close();
    }
  }, { png: capture.toString("base64"), rgb });
}

test.describe("MapLibre vector rendering smoke", () => {
  test.use({ serviceWorkers: "block", viewport: mobileViewport });

  test("draws a worker-processed feature from the Vector basemap style", async ({ page, context }) => {
    if (!baseUrl) throw new Error("MAP_E2E_BASE_URL must point to a running map build");
    const appOrigin = new URL(baseUrl).origin;

    const fixtureStyle = {
      version: 8,
      sources: {
        "smoke-campus": {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              // A closed rectangle large enough to cover the starting campus viewport.
              coordinates: [[
                [124.780, 10.735], [124.805, 10.735], [124.805, 10.755],
                [124.780, 10.755], [124.780, 10.735],
              ]],
            },
          },
        },
      },
      layers: [{
        id: "smoke-campus-fill",
        type: "fill",
        source: "smoke-campus",
        paint: { "fill-color": "#fd00f9" },
      }],
    };

    // A fresh visitor starts on Satellite. Seed only the app's saved map preference.
    await context.addInitScript((origin) => {
      if (window.location.origin === origin) localStorage.setItem("vsu-map-style", "vector");
    }, appOrigin);
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === appOrigin) return route.continue(); // Real app chunks and worker.
      if (
        url.origin === "https://tiles.openfreemap.org" &&
        ["/styles/liberty", "/styles/dark"].includes(url.pathname)
      ) {
        return route.fulfill({
          json: fixtureStyle,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      }
      // Keep external provider traffic out of this browser test.
      return route.abort();
    });

    await openMap(page);
    await expect.poll(() => compositedPixels(page, [253, 0, 249]), {
      timeout: 15_000,
      intervals: [250, 500, 750],
      message: "MapLibre should paint the fixture polygon in a WebGL2-capable browser",
    }).toBeGreaterThan(400);
  });
});

test.describe("MapLibre raster fallback smoke", () => {
  test.use({ serviceWorkers: "block", viewport: mobileViewport });

  const cases = [
    { theme: "light", denyAllWebGL2: true, attribution: "OpenStreetMap",
      tiles: /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/ },
    { theme: "dark", denyAllWebGL2: false, attribution: "CARTO",
      tiles: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/dark_all\/\d+\/\d+\/\d+(?:@2x)?\.png$/ },
  ] as const;

  for (const { theme, denyAllWebGL2, attribution, tiles } of cases) {
    test(`draws the ${theme} raster basemap when renderer initialization fails`, async ({ page, context }) => {
      if (!baseUrl) throw new Error("MAP_E2E_BASE_URL must point to a running map build");
      const appOrigin = new URL(baseUrl).origin;
      await context.addInitScript(({ origin, theme, denyAllWebGL2 }) => {
        if (window.location.origin !== origin) return;
        localStorage.setItem("vsu-map-style", "vector");
        localStorage.setItem("theme", theme);
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          kind: string,
          ...options: unknown[]
        ) {
          // Deny either all WebGL2 or only the renderer's required stencil buffer.
          const attributes = options[0] as WebGLContextAttributes | undefined;
          if (kind === "webgl2" && (denyAllWebGL2 || attributes?.stencil)) return null;
          return Reflect.apply(getContext, this, [kind, ...options]);
        } as typeof getContext;
      }, { origin: appOrigin, theme, denyAllWebGL2 });

      const tile = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGMUea3GQApgIkn1qIZRDUNKAwCzMQFF9XckQQAAAABJRU5ErkJggg==", "base64");
      await context.route("**/*", (route) => {
        const url = route.request().url();
        if (new URL(url).origin === appOrigin) return route.continue();
        if (!tiles.test(url)) return route.abort();
        return route.fulfill({
          contentType: "image/png",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: tile,
        });
      });

      await openMap(page);
      await expect.poll(() => compositedPixels(page, [20, 235, 38]), {
        timeout: 15_000,
        message: "The raster fixture should be visible in the map",
      }).toBeGreaterThan(400);
      const map = page.locator(".leaflet-container");
      await expect(map.locator(".leaflet-gl-layer")).toHaveCount(0);
      await expect(map.locator(".leaflet-control-attribution")
        .getByRole("link", { name: attribution, exact: true })).toBeVisible();
      await expect(map.getByRole("button", { name: "Zoom in", exact: true })).toBeEnabled();
    });
  }
});
