import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ChatMarkdown, parseChatMarkdown } from "./chat-markdown.tsx";

function render(content: string) {
  return renderToStaticMarkup(createElement(ChatMarkdown, { content }));
}

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

test("parseChatMarkdown rejects protocol-relative internal-link lookalikes", () => {
  for (const href of ["//evil.example", " //evil.example", "/%2Fevil.example", "/%2f%2fevil.example", "/\\evil.example", "/%5Cevil.example"]) {
    assert.deepEqual(parseChatMarkdown(`[unsafe](${href})`), [
      {
        type: "paragraph",
        children: [{ type: "text", text: `[unsafe](${href})` }],
      },
    ], href);
  }

  assert.deepEqual(parseChatMarkdown("[safe](/map)"), [
    {
      type: "paragraph",
      children: [{ type: "link", href: "/map", children: [{ type: "text", text: "safe" }] }],
    },
  ]);
});

test("bare student portals use fixed destinations and labels in prose and lists", () => {
  const html = render("Visit (https://my.vsu.edu.ph).\n\n- https://elearning.vsu.edu.ph/");
  assert.match(html, /\(<a href="https:\/\/my\.vsu\.edu\.ph\/" target="_blank" rel="noopener noreferrer"[^>]*>my\.VSU Portal<\/a>\)\./);
  assert.match(html, /<li><a href="https:\/\/elearning\.vsu\.edu\.ph\/" target="_blank" rel="noopener noreferrer"[^>]*>VSU E-Learning \(VSUEE\)<\/a><\/li>/);
});

test("portal Markdown works inside emphasis and alongside bare and internal Map links", () => {
  const html = render("**[Open records](https://my.vsu.edu.ph/)**, *[coursework](https://elearning.vsu.edu.ph)*, and **https://my.vsu.edu.ph/**. [Map](/map)");
  assert.match(html, /<strong><a [^>]*>my\.VSU Portal<\/a><\/strong>/);
  assert.match(html, /<em><a [^>]*>VSU E-Learning \(VSUEE\)<\/a><\/em>/);
  assert.doesNotMatch(html, /Open records|>coursework</);
  assert.equal(html.match(/<a /g)?.length, 4);
  assert.match(html, /<a [^>]*href="\/map"[^>]*>Map<\/a>/);
});

test("unrelated and lookalike URLs stay literal in bare and Markdown referrals", () => {
  for (const href of [
    "https://example.com", "http://my.vsu.edu.ph/", "https://my.vsu.edu.ph.evil.com",
    "https://fake.my.vsu.edu.ph/", "https://my.vsu.edu.ph/login", "https://my.vsu.edu.ph:443/",
    "https://my.vsu.edu.ph/?next=login", "https://elearning.vsu.edu.ph/#courses",
    "https://my.vsu.edu.ph@evil.example/", "https://example.com/?next=https://my.vsu.edu.ph/",
    "javascript:example()",
  ]) {
    const bare = render(href);
    const markdown = render(`[Portal](${href})`);
    assert.doesNotMatch(bare, /<a\b/, href);
    assert.doesNotMatch(markdown, /<a\b/, href);
    assert.ok(bare.includes(href), href);
    assert.ok(markdown.includes(`[Portal](${href})`), href);
  }
});

test("an official-looking label cannot turn a rejected destination into a link", () => {
  const html = render("**[https://my.vsu.edu.ph/](https://example.com)** [https://my.vsu.edu.ph/](/map)");
  assert.equal(html.match(/<a /g)?.length, 1);
  assert.match(html, /<a [^>]*href="\/map"[^>]*>https:\/\/my\.vsu\.edu\.ph\/<\/a>/);
});
