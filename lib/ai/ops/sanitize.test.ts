import assert from "node:assert/strict";
import test from "node:test";

import {
  createFeedbackCredential,
  hashFeedbackToken,
  sanitizeChatText,
  sanitizeTurnMetadata,
} from "./sanitize.ts";

test("sanitizeChatText preserves ordinary class details while redacting unexpected personal data", () => {
  const value = sanitizeChatText(
    "CS 101 meets 8:00 AM in Room A. Email me at student@example.com or +63 917 123 4567. Bearer abc.def.secret",
    8_000,
  );

  assert.match(value, /CS 101 meets 8:00 AM in Room A/);
  assert.match(value, /\[REDACTED EMAIL\]/);
  assert.match(value, /\[REDACTED PHONE\]/);
  assert.match(value, /Bearer \[REDACTED\]/);
  assert.doesNotMatch(value, /student@example\.com|917 123 4567|abc\.def\.secret/);
});

test("sanitizeChatText removes unsafe controls and enforces the database length", () => {
  const value = sanitizeChatText(`hello\u0000${"x".repeat(100)}`, 24);
  assert.equal(value.includes("\u0000"), false);
  assert.equal(value.length, 24);
});

test("feedback credentials are random, opaque, and verifiable by hash", () => {
  const first = createFeedbackCredential();
  const second = createFeedbackCredential();

  assert.notEqual(first.token, second.token);
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(first.hash, /^[a-f0-9]{64}$/);
  assert.equal(hashFeedbackToken(first.token), first.hash);
});

test("sanitizeTurnMetadata keeps only bounded JSON-compatible operational values", () => {
  const metadata = sanitizeTurnMetadata({
    synthetic: true,
    retrievalCounts: { facilities: 32, knowledge: 8 },
    secretToken: "must-not-survive",
    list: Array.from({ length: 80 }, (_, index) => `item-${index}`),
    nested: { one: { two: { three: { four: { five: "too deep" } } } } },
  });

  assert.deepEqual(metadata.synthetic, true);
  assert.deepEqual(metadata.retrievalCounts, { facilities: 32, knowledge: 8 });
  assert.equal(metadata.secretToken, "[REDACTED]");
  assert.equal((metadata.list as unknown[]).length, 25);
  assert.equal(JSON.stringify(metadata).includes("too deep"), false);
});
