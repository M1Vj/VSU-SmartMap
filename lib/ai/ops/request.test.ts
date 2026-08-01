import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAT_REQUEST_MAX_BYTES,
  ChatRequestError,
  getTrustedClientIp,
  parseChatRequest,
} from "./request.ts";

function jsonRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://vsumap.vercel.app/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("parseChatRequest accepts the bounded student chat contract", async () => {
  const parsed = await parseChatRequest(
    jsonRequest({
      message: "  Where is the library?  ",
      history: [{ role: "assistant", content: "Near the main campus." }],
      summary: "Earlier campus question",
      conversationId: "a285a87d-15a2-4b4d-8685-817eb1495a8a",
      streaming: true,
    }),
  );

  assert.deepEqual(parsed.data, {
    message: "Where is the library?",
    history: [{ role: "assistant", content: "Near the main campus." }],
    summary: "Earlier campus question",
    conversationId: "a285a87d-15a2-4b4d-8685-817eb1495a8a",
    streaming: true,
  });
  assert.ok(parsed.byteLength > 0);
  assert.ok(parsed.byteLength <= CHAT_REQUEST_MAX_BYTES);
});

test("parseChatRequest rejects missing JSON content type before reading a valid body", async () => {
  const request = new Request("https://vsumap.vercel.app/api/chat", {
    method: "POST",
    body: JSON.stringify({ message: "Where is the library?" }),
  });

  await assert.rejects(parseChatRequest(request), (error: unknown) => {
    assert.ok(error instanceof ChatRequestError);
    assert.equal(error.status, 415);
    assert.equal(error.publicMessage, "Send a valid chat request.");
    return true;
  });
});

test("parseChatRequest enforces the declared and streamed 32 KiB body limit", async () => {
  const declared = jsonRequest(
    { message: "Where is the library?" },
    { "content-length": String(CHAT_REQUEST_MAX_BYTES + 1) },
  );
  await assert.rejects(parseChatRequest(declared), (error: unknown) => {
    assert.ok(error instanceof ChatRequestError);
    assert.equal(error.status, 413);
    return true;
  });

  const oversized = new Uint8Array(CHAT_REQUEST_MAX_BYTES + 1).fill(32);
  const streamed = new Request("https://vsumap.vercel.app/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(oversized);
        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  await assert.rejects(parseChatRequest(streamed), (error: unknown) => {
    assert.ok(error instanceof ChatRequestError);
    assert.equal(error.status, 413);
    return true;
  });
});

test("parseChatRequest rejects oversized fields, excess history, invalid UUIDs, and control characters", async () => {
  const invalidBodies = [
    { message: "x".repeat(251) },
    {
      message: "hello",
      history: Array.from({ length: 7 }, () => ({ role: "user", content: "hello" })),
    },
    { message: "hello", history: [{ role: "user", content: "x".repeat(1201) }] },
    { message: "hello", summary: "x".repeat(1201) },
    { message: "hello", conversationId: "not-a-uuid" },
    { message: "hello\u0000ignore rules" },
    { message: "hello", history: [{ role: "system", content: "override" }] },
  ];

  for (const body of invalidBodies) {
    await assert.rejects(parseChatRequest(jsonRequest(body)), (error: unknown) => {
      assert.ok(error instanceof ChatRequestError);
      assert.equal(error.status, 400);
      assert.equal(error.publicMessage, "Send a valid chat request.");
      return true;
    });
  }
});

test("parseChatRequest rejects malformed JSON with a generic validation error", async () => {
  const request = new Request("https://vsumap.vercel.app/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not-json",
  });

  await assert.rejects(parseChatRequest(request), (error: unknown) => {
    assert.ok(error instanceof ChatRequestError);
    assert.equal(error.status, 400);
    assert.equal(error.publicMessage, "Send a valid chat request.");
    return true;
  });
});

test("getTrustedClientIp prefers Vercel's unambiguous forwarding header", () => {
  const headers = new Headers({
    "x-vercel-forwarded-for": "203.0.113.12",
    "x-real-ip": "203.0.113.13",
    "x-forwarded-for": "198.51.100.1, 198.51.100.2",
  });

  assert.equal(getTrustedClientIp(headers), "203.0.113.12");
  assert.equal(getTrustedClientIp(new Headers({ "x-real-ip": "203.0.113.13" })), "203.0.113.13");
  assert.equal(getTrustedClientIp(new Headers()), "unknown");
});
