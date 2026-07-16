import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("service worker refreshes cached app icons with a new static cache", () => {
  const serviceWorker = readFileSync("public/sw.js", "utf8");

  assert.match(serviceWorker, /const CACHE_NAME = 'vsu-smartmap-v14';/);
  assert.match(serviceWorker, /'\/icons\/icon-192x192\.png\?v=20260709'/);
  assert.match(serviceWorker, /'\/icons\/icon-512x512\.png\?v=20260709'/);
  assert.doesNotMatch(serviceWorker, /'\/icons\/icon-192x192\.png'/);
  assert.doesNotMatch(serviceWorker, /'\/icons\/icon-512x512\.png'/);
});
