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
