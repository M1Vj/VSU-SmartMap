import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("offline fallback includes the shared credit without mobile navigation space", () => {
  assert.match(
    source,
    /import \{ SiteCredit \} from "@\/components\/layout\/site-credit";/,
  );
  assert.equal(
    source.match(/<SiteCredit reserveMobileNavigation=\{false\} \/>/g)?.length,
    1,
  );
});
