import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./sw.js", import.meta.url), "utf8");

test("the schedule application shell remains available for offline precaching", () => {
  assert.match(source, /STATIC_ASSETS\s*=\s*\[[\s\S]*["']\/schedule["']/);
});

test("schedule, auth, API, and Supabase request payloads are never cached", () => {
  assert.match(source, /request\.method\s*!==\s*["']GET["']/);
  assert.match(source, /url\.pathname\.startsWith\(["']\/auth\/["']\)/);
  assert.match(source, /url\.pathname\.startsWith\(["']\/api\/["']\)/);
  assert.match(source, /\/rest\/v1\/|\/rpc\//);
  assert.doesNotMatch(source, /student_schedule_courses/);
});

test("private requests are handled network-only before cache strategies", () => {
  assert.match(
    source,
    /if\s*\(isNetworkOnlyRequest\(url,\s*request\)\)\s*\{\s*event\.respondWith\(fetch\(request\)\);\s*return;\s*\}/,
  );
});

test("map tiles never cache or synthesize empty 204 responses", () => {
  assert.match(source, /const TILE_CACHE_NAME = ['"]map-tiles-v2['"]/);
  assert.match(source, /response\.status !== 204/);
  const mapTileStart = source.indexOf("if (isMapTileRequest(url))");
  const mapTileEnd = source.indexOf("if (isNextRscRequest(url, request))", mapTileStart);
  assert.ok(mapTileStart >= 0 && mapTileEnd > mapTileStart);
  assert.doesNotMatch(source.slice(mapTileStart, mapTileEnd), /status: 204/);
  assert.match(source.slice(mapTileStart, mapTileEnd), /Response\.error\(\)/);
});

test("ArcGIS tile failures use safe Carto conversion and transparent references", () => {
  assert.match(source, /function getCartoFallbackTileUrl/);
  assert.match(source, /light_all/);
  assert.match(source, /function isArcGisReferenceTile/);
  assert.match(source, /TRANSPARENT_TILE/);
  assert.ok(source.includes("MapServer\\/tile\\/"));
  assert.match(source, /light_all\/\$\{zoom\}\/\$\{x\}\/\$\{y\}\.png/);
});
