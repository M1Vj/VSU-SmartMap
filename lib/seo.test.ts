import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SITE_DESCRIPTION, SITE_TITLE, resolveSiteUrl } from "./seo.ts";

test("site search metadata uses the unofficial campus map title and a full search description", () => {
  assert.equal(SITE_TITLE, "Campus SmartMap for VSU");
  assert.notEqual(SITE_TITLE, "Vercel");
  assert.equal(SITE_DESCRIPTION.length >= 120, true);
  assert.equal(SITE_DESCRIPTION.length <= 160, true);
  assert.match(SITE_DESCRIPTION, /Visayas State University/);
  assert.match(SITE_DESCRIPTION, /Unofficial student-led/);
});

test("manifest uses the same public search title and description", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8")) as {
    name: string;
    description: string;
  };

  assert.equal(manifest.name, SITE_TITLE);
  assert.equal(manifest.description, SITE_DESCRIPTION);
});

test("resolveSiteUrl prefers the explicit site URL over the attached domain", () => {
  // VERCEL_PROJECT_PRODUCTION_URL reports whichever domain is attached to the
  // project, which is not necessarily one that resolves. A deleted DNS record
  // behind it is what made shared links render a blank preview card.
  assert.equal(
    resolveSiteUrl({
      NEXT_PUBLIC_SITE_URL: "https://vsu-map.fc-ssc.online",
      VERCEL_PROJECT_PRODUCTION_URL: "vsumap.maba-studio.fun",
    }),
    "https://vsu-map.fc-ssc.online",
  );
});

test("resolveSiteUrl normalises a bare host and strips trailing slashes", () => {
  assert.equal(
    resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "example.vercel.app" }),
    "https://example.vercel.app",
  );
  assert.equal(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://example.test/" }), "https://example.test");
  assert.equal(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://example.test///" }), "https://example.test");
});

test("resolveSiteUrl falls back to a host this project actually owns", () => {
  // The previous fallback was vsu-smartmap.vercel.app, which has never been a
  // domain of this project, so the last resort was itself unreachable. It was
  // also duplicated into robots.ts and sitemap.ts, where it outlived the fix.
  assert.equal(resolveSiteUrl({}), "https://vsumap.vercel.app");
  assert.equal(
    resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "" }),
    "https://vsumap.vercel.app",
  );
});

test("manifest icon urls are versioned so browsers refresh branded assets", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8")) as {
    icons: Array<{ src: string }>;
  };

  assert.ok(manifest.icons.length > 0);

  for (const icon of manifest.icons) {
    assert.match(icon.src, /\?v=20260709$/);
  }
});
