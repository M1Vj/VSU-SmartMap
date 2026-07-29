import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readToasterSource() {
  return readFile(new URL("./sonner.tsx", import.meta.url), "utf8");
}

test("mobile student toasts stay above the fixed navigation", async () => {
  const source = await readToasterSource();

  assert.match(source, /usePathname/);
  assert.match(source, /useIsMobile/);
  assert.match(source, /shouldShowStudentNavigation/);
  assert.match(source, /offset=\{toastOffset\}/);
  assert.match(source, /mobileOffset=\{toastOffset\}/);
  assert.match(
    source,
    /calc\(6\.5rem \+ env\(safe-area-inset-bottom\)\)/,
  );
});
