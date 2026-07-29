import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

test("student routes keep one global desktop credit before mobile navigation", () => {
  assert.match(
    source,
    /import \{ SiteCredit \} from "@\/components\/layout\/site-credit";/,
  );
  assert.equal(source.match(/<SiteCredit \/>/g)?.length, 1);
  assert.ok(
    source.indexOf("<SiteCredit />") <
      source.indexOf('<StudentTabs placement="bottom" />'),
    "global desktop credit must retain its single ownership before mobile navigation",
  );
});
