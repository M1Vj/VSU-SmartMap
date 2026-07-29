import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readStudentTabsSource() {
  return readFile(new URL("./student-tabs.tsx", import.meta.url), "utf8");
}

async function readGlobalStyles() {
  return readFile(new URL("../app/globals.css", import.meta.url), "utf8");
}

test("mobile student navigation stays above map loading and error overlays", async () => {
  const source = await readStudentTabsSource();
  const globalStyles = await readGlobalStyles();
  const mobileWrapperMatch = source.match(
    /const wrapperClasses = isInline\s*\?\s*"[^"]*"[^\n]*\n\s*:\s*"([^"]*)"/,
  );

  assert.match(source, /fixed inset-x-0 bottom-0 z-50/);
  assert.doesNotMatch(source, /fixed inset-x-0 bottom-0 z-20/);
  assert.ok(mobileWrapperMatch, "Expected to find the non-inline wrapper classes");
  assert.doesNotMatch(mobileWrapperMatch[1], /\bborder-t\b/);
  assert.match(mobileWrapperMatch[1], /\bpt-2\b/);
  assert.match(
    mobileWrapperMatch[1],
    /min-h-\[calc\(var\(--student-mobile-nav-height\)\+env\(safe-area-inset-bottom,0px\)\)\]/,
  );
  assert.doesNotMatch(source, /4\.5625rem/);
  assert.match(globalStyles, /--student-mobile-nav-height:\s*4\.5625rem;/);
});
