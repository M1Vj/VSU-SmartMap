"use client";

import Link from "next/link";
import type { ReactNode } from "react";

const studentPortals = [
  { href: "https://my.vsu.edu.ph/", label: "my.VSU Portal" },
  { href: "https://elearning.vsu.edu.ph/", label: "VSU E-Learning (VSUEE)" },
] as const;

type StudentPortal = (typeof studentPortals)[number];

type InlineNode =
  | { type: "text"; text: string }
  | { type: "bold"; children: InlineNode[] }
  | { type: "italic"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] }
  | { type: "portal"; portal: StudentPortal };

type InlineToken = { start: number; end: number; node: InlineNode };

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

function parseInline(text: string, allowLinks = true): InlineNode[] {
  const nodes: InlineNode[] = [];
  let index = 0;

  while (index < text.length) {
    const next = findNextToken(text, index, allowLinks);
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

function findNextToken(text: string, from: number, allowLinks: boolean): InlineToken | null {
  const candidates = [
    findDelimitedToken(text, from, "**", "bold", allowLinks),
    findDelimitedToken(text, from, "*", "italic", allowLinks),
    ...(allowLinks ? [findMarkdownLinkToken(text, from), findBarePortalToken(text, from)] : []),
  ].filter((token): token is InlineToken => token !== null);

  candidates.sort((a, b) => a.start - b.start);
  return candidates[0] ?? null;
}

function findDelimitedToken(
  text: string,
  from: number,
  delimiter: "*" | "**",
  type: "bold" | "italic",
  allowLinks: boolean,
): InlineToken | null {
  const start = text.indexOf(delimiter, from);
  if (start === -1) return null;
  if (delimiter === "*" && text[start + 1] === "*") {
    return findDelimitedToken(text, start + 2, delimiter, type, allowLinks);
  }

  const contentStart = start + delimiter.length;
  const end = text.indexOf(delimiter, contentStart);
  if (end === -1 || end === contentStart) return null;
  if (delimiter === "*" && text[end + 1] === "*") {
    return findDelimitedToken(text, end + 2, delimiter, type, allowLinks);
  }

  return {
    start,
    end: end + delimiter.length,
    node: { type, children: parseInline(text.slice(contentStart, end), allowLinks) },
  };
}

function findStudentPortal(href: string) {
  return studentPortals.find((portal) => href === portal.href || href === portal.href.slice(0, -1));
}

function findMarkdownLinkToken(text: string, from: number): InlineToken | null {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  pattern.lastIndex = from;
  const match = pattern.exec(text);
  if (!match) return null;

  const [syntax, label, href] = match;
  const portal = findStudentPortal(href);
  let node: InlineNode = { type: "text", text: syntax };
  if (portal) {
    node = { type: "portal", portal };
  } else if (isInternalHref(href)) {
    node = { type: "link", href, children: parseInline(label, false) };
  }
  // Consume rejected Markdown as a unit, even if its label contains a portal URL.
  return { start: match.index, end: match.index + syntax.length, node };
}

function isInternalHref(href: string): boolean {
  if (href !== href.trim() || !href.startsWith("/")) return false;
  try {
    return !/^\/\s*[/\\]/.test(decodeURIComponent(href));
  } catch {
    return false;
  }
}

function findBarePortalToken(text: string, from: number): InlineToken | null {
  const pattern = /(?<=^|[\s([{<"'“‘])https?:\/\/[^\s<>"'”’]+/gi;
  pattern.lastIndex = from;
  for (const match of text.matchAll(pattern)) {
    const url = match[0].replace(/[.,!)\]}]+$/, "");
    const portal = findStudentPortal(url);
    if (portal) {
      return { start: match.index, end: match.index + url.length, node: { type: "portal", portal } };
    }
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
    if (node.type === "portal") {
      return (
        <a
          key={key}
          href={node.portal.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 max-w-full items-center rounded-md px-2 align-middle font-medium text-primary underline underline-offset-2 hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {node.portal.label}
        </a>
      );
    }
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
    <div className="space-y-2 text-sm [overflow-wrap:anywhere]">
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
