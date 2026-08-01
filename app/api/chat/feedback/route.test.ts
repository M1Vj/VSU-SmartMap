import assert from "node:assert/strict";
import test, { mock } from "node:test";

let quota = { allowed: true as boolean, retryAfterSeconds: 0 };
let quotaError = false;
let submitResult: "accepted" | "forbidden" | "error" = "accepted";
const quotaCalls: Array<Record<string, unknown>> = [];

mock.module("@/lib/ai/rate-limit", { namedExports: {
  async consumeDurableChatFeedbackRateLimit(input: Record<string, unknown>) {
    quotaCalls.push(input);
    if (quotaError) throw new Error("quota unavailable");
    return quota;
  },
} });

mock.module("@/lib/ai/ops/feedback", { namedExports: {
  FeedbackRequestError: class FeedbackRequestError extends Error {
    constructor(readonly status: number) { super("invalid"); }
  },
  async parseFeedbackRequest(request: Request) {
    const body = await request.text();
    return { data: JSON.parse(body), byteLength: Buffer.byteLength(body) };
  },
  async submitChatFeedback() { return submitResult; },
} });

const routeModule = import("./route.ts");

function makeRequest(body: Record<string, unknown>) {
  return new Request("https://example.test/api/chat/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", "x-vercel-forwarded-for": "203.0.113.9" },
    body: JSON.stringify(body),
  });
}

test.beforeEach(() => {
  quota = { allowed: true, retryAfterSeconds: 0 };
  quotaError = false;
  submitResult = "accepted";
  quotaCalls.length = 0;
});

test("rate-limits by trusted IP and returns no-store on success", async () => {
  const body = { turnId: "turn", feedbackToken: "token", rating: "positive" };
  const response = await (await routeModule).POST(makeRequest(body));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { accepted: true });
  assert.equal(quotaCalls[0]?.subject, "203.0.113.9");
  assert.ok(Number(quotaCalls[0]?.costBytes) > 0);
});

test("fails closed when quota storage is unavailable", async () => {
  quotaError = true;
  const response = await (await routeModule).POST(makeRequest({ rating: "positive" }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(Number(response.headers.get("retry-after")) >= 1);
});

test("uses the same generic forbidden response for absent turns and invalid tokens", async () => {
  submitResult = "forbidden";
  const response = await (await routeModule).POST(makeRequest({ rating: "positive" }));
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Unable to accept feedback." });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("returns generic no-store persistence failures", async () => {
  submitResult = "error";
  const response = await (await routeModule).POST(makeRequest({ rating: "positive" }));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Unable to accept feedback." });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

