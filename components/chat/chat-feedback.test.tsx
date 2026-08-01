import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ChatFeedback,
  FEEDBACK_REASONS,
  submitChatFeedback,
} from "./chat-feedback.tsx";

const credentials = {
  turnId: "turn-private",
  feedbackToken: "token-private",
  requestId: "request-private",
};

test("ChatFeedback renders accessible compact controls without exposing credentials", () => {
  const markup = renderToStaticMarkup(createElement(ChatFeedback, { credentials }));

  assert.match(markup, /aria-label="Helpful response"/);
  assert.match(markup, /aria-label="Not helpful response"/);
  assert.doesNotMatch(markup, /turn-private|token-private|request-private/);
  assert.deepEqual(FEEDBACK_REASONS, [
    "incorrect",
    "outdated",
    "wrong_location",
    "unhelpful",
    "unsafe",
    "other",
  ]);
});

test("submitChatFeedback posts only bounded feedback fields and credentials", async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const fetcher: typeof fetch = async (url, init) => {
    request = { url: String(url), init };
    return new Response(null, { status: 204 });
  };

  await submitChatFeedback(
    credentials,
    { rating: "negative", reason: "wrong_location", comment: "Wrong building" },
    fetcher,
  );

  assert.equal(request?.url, "/api/chat/feedback");
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    ...credentials,
    rating: "negative",
    reason: "wrong_location",
    comment: "Wrong building",
  });
});

test("ChatMessage mounts feedback only for credentialed non-error assistant messages", async () => {
  const source = await readFile(new URL("./chat-message.tsx", import.meta.url), "utf8");
  assert.match(source, /isAssistant && !isError && feedbackCredentials/);
  assert.match(source, /<ChatFeedback credentials=\{feedbackCredentials\}/);
});
