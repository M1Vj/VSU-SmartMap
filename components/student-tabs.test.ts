import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readStudentTabsSource() {
  return readFile(new URL("./student-tabs.tsx", import.meta.url), "utf8");
}

test("mobile student navigation stays above map loading and error overlays", async () => {
  const source = await readStudentTabsSource();

  assert.match(source, /fixed inset-x-0 bottom-0 z-50/);
  assert.doesNotMatch(source, /fixed inset-x-0 bottom-0 z-20/);
});
