import test from "node:test";
import assert from "node:assert/strict";

import {
  ChatRateLimiter,
  consumeDurableChatFeedbackRateLimit,
  consumeDurableChatRateLimit,
} from "./rate-limit.ts";

test("ChatRateLimiter blocks the ninth request in a minute", () => {
  let now = Date.parse("2026-07-04T00:00:00.000Z");
  const limiter = new ChatRateLimiter({ now: () => now });

  for (let i = 0; i < 8; i += 1) {
    assert.deepEqual(limiter.check("127.0.0.1"), { allowed: true });
  }

  assert.deepEqual(limiter.check("127.0.0.1"), {
    allowed: false,
    reason: "minute",
    message: "You're sending messages too quickly. Please wait a moment.",
  });
});

test("ChatRateLimiter rolls the minute window forward", () => {
  let now = Date.parse("2026-07-04T00:00:00.000Z");
  const limiter = new ChatRateLimiter({ now: () => now });

  for (let i = 0; i < 8; i += 1) limiter.check("127.0.0.1");
  now += 60_000;

  assert.deepEqual(limiter.check("127.0.0.1"), { allowed: true });
});

test("ChatRateLimiter blocks after the daily quota and rolls after 24 hours", () => {
  let now = Date.parse("2026-07-04T00:00:00.000Z");
  const limiter = new ChatRateLimiter({ now: () => now });

  for (let i = 0; i < 80; i += 1) {
    now += 60_000;
    assert.deepEqual(limiter.check("127.0.0.1"), { allowed: true });
  }

  now += 60_000;
  assert.deepEqual(limiter.check("127.0.0.1"), {
    allowed: false,
    reason: "day",
    message: "You've reached today's chat limit. Please try again tomorrow.",
  });

  now = Date.parse("2026-07-05T00:01:00.000Z");
  assert.deepEqual(limiter.check("127.0.0.1"), { allowed: true });
});

test("ChatRateLimiter tracks independent IP addresses separately", () => {
  const limiter = new ChatRateLimiter({ now: () => 1_000 });

  for (let i = 0; i < 8; i += 1) limiter.check("127.0.0.1");

  assert.equal(limiter.check("127.0.0.1").allowed, false);
  assert.deepEqual(limiter.check("127.0.0.2"), { allowed: true });
});

test("ChatRateLimiter sweeps idle clients so the map stays bounded", () => {
  let now = Date.parse("2026-07-04T00:00:00.000Z");
  const limiter = new ChatRateLimiter({ now: () => now });

  limiter.check("old-ip");
  now += 25 * 60 * 60 * 1000;

  for (let i = 0; i < 256; i += 1) {
    now += 61_000;
    limiter.check("new-ip");
  }

  assert.equal(limiter.trackedClients, 1);
});

test("consumeDurableChatRateLimit enforces fixed minute and day scopes", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const result = await consumeDurableChatRateLimit({
    subject: "203.0.113.12",
    costBytes: 512,
    consume: async (input) => {
      calls.push(input);
      return { allowed: true, retryAfterSeconds: 0 };
    },
  });

  assert.deepEqual(result, { allowed: true });
  assert.deepEqual(calls, [
    {
      scope: "chat:minute",
      subject: "203.0.113.12",
      requestLimit: 8,
      byteLimit: 8 * 32 * 1024,
      windowSeconds: 60,
      costBytes: 512,
    },
    {
      scope: "chat:day",
      subject: "203.0.113.12",
      requestLimit: 80,
      byteLimit: 80 * 32 * 1024,
      windowSeconds: 86_400,
      costBytes: 512,
    },
  ]);
});

test("consumeDurableChatRateLimit fails closed and preserves retry timing", async () => {
  let calls = 0;
  const minute = await consumeDurableChatRateLimit({
    subject: "203.0.113.12",
    costBytes: 10,
    consume: async () => {
      calls += 1;
      return { allowed: false, retryAfterSeconds: 37 };
    },
  });

  assert.deepEqual(minute, {
    allowed: false,
    reason: "minute",
    retryAfterSeconds: 37,
    message: "You're sending messages too quickly. Please wait a moment.",
  });
  assert.equal(calls, 1);

  const day = await consumeDurableChatRateLimit({
    subject: "203.0.113.12",
    costBytes: 10,
    consume: async (input) => ({
      allowed: input.scope !== "chat:day",
      retryAfterSeconds: input.scope === "chat:day" ? 4_200 : 0,
    }),
  });
  assert.deepEqual(day, {
    allowed: false,
    reason: "day",
    retryAfterSeconds: 4_200,
    message: "You've reached today's chat limit. Please try again tomorrow.",
  });
});

test("consumeDurableChatFeedbackRateLimit uses one fixed bounded scope", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const result = await consumeDurableChatFeedbackRateLimit({
    subject: "203.0.113.12",
    costBytes: 512,
    consume: async (input) => {
      calls.push(input);
      return { allowed: true, retryAfterSeconds: 0 };
    },
  });
  assert.deepEqual(result, { allowed: true, retryAfterSeconds: 0 });
  assert.deepEqual(calls, [{
    scope: "chat:feedback",
    subject: "203.0.113.12",
    requestLimit: 30,
    byteLimit: 30 * 4 * 1024,
    windowSeconds: 15 * 60,
    costBytes: 512,
  }]);
});
