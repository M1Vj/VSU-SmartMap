import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

test("student routes share one developer credit above the mobile navigation", () => {
  assert.match(
    source,
    /import \{ SiteCredit \} from "@\/components\/layout\/site-credit";/,
  );
  assert.equal(source.match(/<SiteCredit \/>/g)?.length, 1);
  assert.ok(
    source.indexOf("<SiteCredit />") <
      source.indexOf('<StudentTabs placement="bottom" />'),
    "developer credit must render before the fixed mobile navigation",
  );
});
