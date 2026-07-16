import test from "node:test";
import assert from "node:assert/strict";

import { parseChatMarkdown } from "./chat-markdown.tsx";

test("parseChatMarkdown tokenizes bold and italic inline spans", () => {
  assert.deepEqual(parseChatMarkdown("Go to **Admin** and *ask politely*."), [
    {
      type: "paragraph",
      children: [
        { type: "text", text: "Go to " },
        { type: "bold", children: [{ type: "text", text: "Admin" }] },
        { type: "text", text: " and " },
        { type: "italic", children: [{ type: "text", text: "ask politely" }] },
        { type: "text", text: "." },
      ],
    },
  ]);
});

test("parseChatMarkdown groups bullet and numbered lists", () => {
  assert.deepEqual(parseChatMarkdown("- Library\n- Admin\n\n1. First\n2. Second"), [
    {
      type: "list",
      ordered: false,
      items: [
        [{ type: "text", text: "Library" }],
        [{ type: "text", text: "Admin" }],
      ],
    },
    {
      type: "list",
      ordered: true,
      items: [
        [{ type: "text", text: "First" }],
        [{ type: "text", text: "Second" }],
      ],
    },
  ]);
});

test("parseChatMarkdown keeps non-internal links literal", () => {
  assert.deepEqual(parseChatMarkdown("[VSU](https://example.com) and [Map](/map)"), [
    {
      type: "paragraph",
      children: [
        { type: "text", text: "[VSU](https://example.com) and " },
        { type: "link", href: "/map", children: [{ type: "text", text: "Map" }] },
      ],
    },
  ]);
});
