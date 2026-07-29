import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rootLayoutSource = readFileSync(
  new URL("./layout.tsx", import.meta.url),
  "utf8",
);

test("root layout renders Vercel Speed Insights exactly once", () => {
  assert.match(
    rootLayoutSource,
    /import \{ SpeedInsights \} from "@vercel\/speed-insights\/next";/,
  );
  assert.equal(rootLayoutSource.match(/<SpeedInsights \/>/g)?.length, 1);
});
