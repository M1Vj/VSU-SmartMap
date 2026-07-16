import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SITE_DESCRIPTION, SITE_TITLE } from "./seo.ts";

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

test("manifest icon urls are versioned so browsers refresh branded assets", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8")) as {
    icons: Array<{ src: string }>;
  };

  assert.ok(manifest.icons.length > 0);

  for (const icon of manifest.icons) {
    assert.match(icon.src, /\?v=20260709$/);
  }
});
