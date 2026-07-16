"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type InlineNode =
  | { type: "text"; text: string }
  | { type: "bold"; children: InlineNode[] }
  | { type: "italic"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] };

type MarkdownBlock =
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] };

const bulletPattern = /^[-*]\s+(.+)$/;
const orderedPattern = /^\d+\.\s+(.+)$/;

export function parseChatMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let activeList: Extract<MarkdownBlock, { type: "list" }> | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", children: parseInline(paragraph.join("\n")) });
    paragraph = [];
  };

  const flushList = () => {
    if (!activeList) return;
    blocks.push(activeList);
    activeList = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const bulletMatch = trimmed.match(bulletPattern);
    const orderedMatch = trimmed.match(orderedPattern);

    if (bulletMatch || orderedMatch) {
      flushParagraph();
      const ordered = Boolean(orderedMatch);
      const content = bulletMatch?.[1] ?? orderedMatch?.[1] ?? "";

      if (!activeList || activeList.ordered !== ordered) {
        flushList();
        activeList = { type: "list", ordered, items: [] };
      }

      activeList.items.push(parseInline(content));
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks;
}

function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let index = 0;

  while (index < text.length) {
    const next = findNextToken(text, index);
    if (!next) {
      nodes.push({ type: "text", text: text.slice(index) });
      break;
    }

    if (next.start > index) {
      nodes.push({ type: "text", text: text.slice(index, next.start) });
    }

    nodes.push(next.node);
    index = next.end;
  }

  return mergeTextNodes(nodes);
}

function findNextToken(
  text: string,
  from: number
): { start: number; end: number; node: InlineNode } | null {
  const candidates = [
    findDelimitedToken(text, from, "**", "bold"),
    findDelimitedToken(text, from, "*", "italic"),
    findInternalLinkToken(text, from),
  ].filter(Boolean) as Array<{ start: number; end: number; node: InlineNode }>;

  candidates.sort((a, b) => a.start - b.start);
  return candidates[0] ?? null;
}

function findDelimitedToken(
  text: string,
  from: number,
  delimiter: "*" | "**",
  type: "bold" | "italic"
): { start: number; end: number; node: InlineNode } | null {
  const start = text.indexOf(delimiter, from);
  if (start === -1) return null;
  if (delimiter === "*" && text[start + 1] === "*") {
    return findDelimitedToken(text, start + 2, delimiter, type);
  }

  const contentStart = start + delimiter.length;
  const end = text.indexOf(delimiter, contentStart);
  if (end === -1 || end === contentStart) return null;
  if (delimiter === "*" && text[end + 1] === "*") {
    return findDelimitedToken(text, end + 2, delimiter, type);
  }

  return {
    start,
    end: end + delimiter.length,
    node: { type, children: parseInline(text.slice(contentStart, end)) },
  };
}

function findInternalLinkToken(text: string, from: number): { start: number; end: number; node: InlineNode } | null {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  pattern.lastIndex = from;

  for (const match of text.matchAll(pattern)) {
    const href = match[2];
    if (!href.startsWith("/")) continue;

    return {
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      node: { type: "link", href, children: parseInline(match[1]) },
    };
  }

  return null;
}

function mergeTextNodes(nodes: InlineNode[]): InlineNode[] {
  return nodes.reduce<InlineNode[]>((merged, node) => {
    const previous = merged[merged.length - 1];
    if (previous?.type === "text" && node.type === "text") {
      previous.text += node.text;
      return merged;
    }
    merged.push(node);
    return merged;
  }, []);
}

function renderInline(nodes: InlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.type === "text") return node.text;
    if (node.type === "bold") return <strong key={key}>{renderInline(node.children, key)}</strong>;
    if (node.type === "italic") return <em key={key}>{renderInline(node.children, key)}</em>;
    return (
      <Link key={key} href={node.href} className="font-medium text-primary underline-offset-2 hover:underline">
        {renderInline(node.children, key)}
      </Link>
    );
  });
}

export function ChatMarkdown({ content }: { content: string }) {
  const blocks = parseChatMarkdown(content);

  return (
    <div className="space-y-2 text-sm">
      {blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return (
            <p key={index} className="whitespace-pre-wrap">
              {renderInline(block.children, `p-${index}`)}
            </p>
          );
        }

        const ListTag = block.ordered ? "ol" : "ul";
        return (
          <ListTag
            key={index}
            className={`space-y-1 pl-4 ${block.ordered ? "list-decimal" : "list-disc"}`}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderInline(item, `li-${index}-${itemIndex}`)}</li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}
