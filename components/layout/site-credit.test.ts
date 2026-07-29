import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readCreditSource() {
  return readFile(
    new URL("./site-credit.tsx", import.meta.url),
    "utf8",
  ).catch(() => "");
}

test("site credit is a tiny centered link to the developer profile", async () => {
  const source = await readCreditSource();

  assert.match(source, /<footer\b/);
  assert.match(source, /Developed by Vj F Mabansag/);
  assert.match(source, /href="https:\/\/github\.com\/M1Vj"/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /text-\[10px\]/);
  assert.match(source, /text-center/);
});

test("site credit stays above the fixed mobile navigation safe area", async () => {
  const source = await readCreditSource();

  assert.match(source, /usePathname/);
  assert.match(source, /shouldShowStudentNavigation/);
  assert.match(source, /reserveMobileNavigation/);
  assert.match(
    source,
    /mb-\[calc\(4\.5625rem\+env\(safe-area-inset-bottom\)\)\]/,
  );
  assert.doesNotMatch(source, /5\.25rem/);
  assert.match(source, /md:mb-0/);
});

test("site credit remains transparent over every public page", async () => {
  const source = await readCreditSource();

  assert.match(source, /bg-transparent/);
  assert.match(source, /-mt-5/);
  assert.match(source, /if \(pathname === "\/"\) return null;/);
  assert.doesNotMatch(source, /aria-hidden="true"/);
  assert.doesNotMatch(source, /shrink-0 md:hidden/);
  assert.doesNotMatch(source, /\bbg-background\b/);
  assert.doesNotMatch(source, /\bborder-t\b/);
});
