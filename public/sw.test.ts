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
  assert.match(source, /const PREVIOUS_TILE_CACHE_NAME = ['"]map-tiles-v1['"]/);
  assert.match(source, /async function migratePreviousTileCache/);
  assert.match(source, /response\.status !== 204/);
  const mapTileStart = source.indexOf("async function cacheMapAssetRequest");
  const mapTileEnd = source.indexOf("async function migratePreviousTileCache", mapTileStart);
  assert.ok(mapTileStart >= 0 && mapTileEnd > mapTileStart);
  assert.doesNotMatch(source.slice(mapTileStart, mapTileEnd), /status: 204/);
  assert.match(source.slice(mapTileStart, mapTileEnd), /Response\.error\(\)/);
});

test("ArcGIS tile failures stay network errors for the MapWrapper fallback", () => {
  assert.doesNotMatch(source, /CARTO_LIGHT_TILE_HOST/);
  assert.doesNotMatch(source, /TRANSPARENT_TILE/);
  assert.doesNotMatch(source, /fallbackArcGisTile|getCartoFallbackTileUrl|satelliteFallbackBaseAvailable/);
  assert.match(source, /Response\.error\(\)/);
});

test("OpenFreeMap style dependencies use the approved map asset cache", () => {
  assert.match(source, /function isMapAssetRequest/);
  assert.match(source, /styles/);
  assert.match(source, /sprites/);
  assert.match(source, /fonts/);

  assert.match(source, /const MAP_ASSET_CACHE_NAME = ['"]map-assets-v1['"]/);
  assert.match(source, /const MAP_ASSET_CACHE_MAX_ENTRIES = 128/);
  assert.match(source, /const keepCaches = \[CACHE_NAME, TILE_CACHE_NAME, MAP_ASSET_CACHE_NAME\]/);
  const mapTileBranchStart = source.indexOf("if (isMapTileRequest(url))");
  const mapAssetBranchStart = source.indexOf("if (isMapAssetRequest(url))");
  const mapBranchEnd = source.indexOf("if (isNextRscRequest(url, request))");
  assert.ok(mapTileBranchStart >= 0 && mapAssetBranchStart > mapTileBranchStart);
  assert.ok(mapBranchEnd > mapAssetBranchStart);
  const mapTileBranch = source.slice(mapTileBranchStart, mapAssetBranchStart);
  const mapAssetBranch = source.slice(mapAssetBranchStart, mapBranchEnd);
  assert.match(mapTileBranch, /cacheMapAssetRequest\(\s*request,\s*TILE_CACHE_NAME/);
  assert.match(mapAssetBranch, /cacheMapAssetRequest\(\s*request,\s*MAP_ASSET_CACHE_NAME/);
  assert.match(source, /async function cacheMapAssetRequest[\s\S]*caches\.open\(cacheName\)/);
  assert.match(source, /async function cacheMapAssetRequest[\s\S]*cache\.match\(request\)/);
  assert.match(source, /async function cacheMapAssetRequest[\s\S]*cache[\s\S]*\.put\(request/);
});

test("static asset cache writes settle before response and tolerate write failures", () => {
  const staticStart = source.indexOf("if (url.pathname.startsWith('/_next/static/'))");
  const staticEnd = source.indexOf("if (isMapTileRequest(url))", staticStart);
  assert.ok(staticStart >= 0 && staticEnd > staticStart);
  const staticBranch = source.slice(staticStart, staticEnd);
  assert.match(staticBranch, /fetchAndCacheStaticAsset\(request, cache\)/);

  const staticHelperStart = source.indexOf("async function fetchAndCacheStaticAsset");
  const staticHelperEnd = source.indexOf("async function migratePreviousTileCache", staticHelperStart);
  assert.ok(staticHelperStart >= 0 && staticHelperEnd > staticHelperStart);
  const staticHelper = source.slice(staticHelperStart, staticHelperEnd);
  assert.match(staticHelper, /await cache\.put\(request, response\.clone\(\)\)/);
  assert.match(staticHelper, /try[\s\S]*await cache\.put[\s\S]*catch/);
});
