import test from "node:test";
import assert from "node:assert/strict";

import { ApiKeyManager } from "./api-key-manager.ts";

test("ApiKeyManager selects the least recently used ready key", () => {
  let now = 1_000;
  const manager = new ApiKeyManager(["key-a", "key-b", "key-c"], {
    now: () => now,
  });

  assert.equal(manager.getNextKey(), "key-a");
  now += 10;
  assert.equal(manager.getNextKey(), "key-b");
  now += 10;
  assert.equal(manager.getNextKey(), "key-c");
  now += 10;
  assert.equal(manager.getNextKey(), "key-a");
});

test("ApiKeyManager applies a short cooldown for per-minute rate limits", () => {
  let now = 10_000;
  const manager = new ApiKeyManager(["key-a", "key-b"], {
    now: () => now,
  });

  manager.markKeyFailed("key-a", "rpm");

  assert.equal(manager.getNextKey(), "key-b");
  now += 59_999;
  assert.equal(manager.getNextKey(), "key-b");
  now += 1;
  assert.equal(manager.getNextKey(), "key-a");
});

test("ApiKeyManager cools per-day quota failures until next Pacific midnight", () => {
  let now = Date.parse("2026-07-04T18:30:00.000Z");
  const manager = new ApiKeyManager(["key-a", "key-b"], {
    now: () => now,
  });

  manager.markKeyFailed("key-a", "rpd");

  now = Date.parse("2026-07-05T06:59:59.000Z");
  assert.equal(manager.getNextKey(), "key-b");

  now = Date.parse("2026-07-05T07:00:00.000Z");
  assert.equal(manager.getNextKey(), "key-a");
});

test("ApiKeyManager keeps the existing all-keys-cooling error message", () => {
  const manager = new ApiKeyManager(["key-a"], {
    now: () => 1_000,
  });

  manager.markKeyFailed("key-a", "rpm");

  assert.throws(
    () => manager.getNextKey(),
    /All API keys are currently rate limited\. Please try again later\./
  );
});
