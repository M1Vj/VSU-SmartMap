import assert from "node:assert/strict";
import test from "node:test";

import { resolveTurnstileSiteKey } from "./turnstile-config.ts";

test("localhost always uses Cloudflare's public test site key", () => {
  assert.equal(
    resolveTurnstileSiteKey({
      configuredKey: "production-site-key",
      hostname: "localhost",
      nodeEnv: "production",
    }),
    "1x00000000000000000000AA",
  );
  assert.equal(
    resolveTurnstileSiteKey({
      configuredKey: "production-site-key",
      hostname: "127.0.0.1",
      nodeEnv: "production",
    }),
    "1x00000000000000000000AA",
  );
});

test("production hosts require a non-placeholder configured key", () => {
  assert.equal(
    resolveTurnstileSiteKey({
      configuredKey: "production-site-key",
      hostname: "vsumap.vercel.app",
      nodeEnv: "production",
    }),
    "production-site-key",
  );
  assert.equal(
    resolveTurnstileSiteKey({
      configuredKey: "your-turnstile-site-key",
      hostname: "vsumap.vercel.app",
      nodeEnv: "production",
    }),
    null,
  );
});
