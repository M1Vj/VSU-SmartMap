import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("development service-worker cleanup removes map asset caches", async () => {
  const source = await readFile(new URL("./service-worker-registration.tsx", import.meta.url), "utf8");

  assert.match(source, /cacheName\.startsWith\("map-assets-"\)/);
});
