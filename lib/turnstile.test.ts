import assert from "node:assert/strict";
import test, { mock } from "node:test";

import { verifyTurnstileToken } from "./turnstile.ts";

const originalNodeEnv = process.env.NODE_ENV;
const originalSecret = process.env.TURNSTILE_SECRET_KEY;
const originalFetch = globalThis.fetch;
const mutableEnvironment = process.env as Record<string, string | undefined>;

function restoreEnvironment() {
  if (originalNodeEnv === undefined) delete mutableEnvironment.NODE_ENV;
  else mutableEnvironment.NODE_ENV = originalNodeEnv;

  if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = originalSecret;

  globalThis.fetch = originalFetch;
  mock.restoreAll();
}

test.afterEach(restoreEnvironment);

test("production fails verification when TURNSTILE_SECRET_KEY is missing", async () => {
  mutableEnvironment.NODE_ENV = "production";
  delete process.env.TURNSTILE_SECRET_KEY;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch must not run without a secret");
  };

  const result = await verifyTurnstileToken("token");

  assert.deepEqual(result, {
    success: false,
    error: "Captcha verification is unavailable",
  });
  assert.equal(fetchCalls, 0);
});

test("a failed Turnstile response remains a verification failure", async () => {
  mutableEnvironment.NODE_ENV = "production";
  process.env.TURNSTILE_SECRET_KEY = "production-secret";
  mock.method(console, "error", () => {});
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const result = await verifyTurnstileToken("bad-token");

  assert.deepEqual(result, {
    success: false,
    error: "Captcha verification failed: invalid-input-response",
  });
});

test("a Turnstile network error remains a verification failure", async () => {
  mutableEnvironment.NODE_ENV = "production";
  process.env.TURNSTILE_SECRET_KEY = "production-secret";
  mock.method(console, "error", () => {});
  globalThis.fetch = async () => {
    throw new Error("network unavailable");
  };

  const result = await verifyTurnstileToken("token");

  assert.deepEqual(result, {
    success: false,
    error: "Failed to verify captcha",
  });
});

test("development verification uses Cloudflare's official test secret", async () => {
  mutableEnvironment.NODE_ENV = "development";
  delete process.env.TURNSTILE_SECRET_KEY;
  let submittedBody = "";
  globalThis.fetch = async (_input, init) => {
    submittedBody = String(init?.body);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const result = await verifyTurnstileToken("development-token", "request-id");

  assert.deepEqual(result, { success: true });
  const params = new URLSearchParams(submittedBody);
  assert.equal(params.get("secret"), "1x0000000000000000000000000000000AA");
  assert.equal(params.get("response"), "development-token");
  assert.equal(params.get("idempotency_key"), "request-id");
});
