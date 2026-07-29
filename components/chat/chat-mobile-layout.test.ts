import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(relativePath: string) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

function requiredMatch(source: string, pattern: RegExp, description: string) {
  const match = source.match(pattern);
  assert.ok(match, `Expected to find ${description}`);
  return match;
}

function enclosingJsxClasses(source: string, text: string) {
  const textIndex = source.indexOf(text);
  assert.notEqual(textIndex, -1, `Expected to find ${text}`);

  const returnIndex = source.lastIndexOf("return (", textIndex);
  assert.notEqual(returnIndex, -1, "Expected disclaimer inside returned JSX");

  const stack: Array<{ tag: string; classes: string }> = [];
  const tagPattern = /<(\/?)([a-z][\w.-]*)\b([^>]*)>/g;
  const jsxBeforeText = source.slice(returnIndex, textIndex);

  for (const match of jsxBeforeText.matchAll(tagPattern)) {
    const [, closing, tag, attributes] = match;
    if (closing) {
      const matchingIndex = stack.findLastIndex((entry) => entry.tag === tag);
      if (matchingIndex !== -1) stack.splice(matchingIndex);
      continue;
    }
    if (attributes.trimEnd().endsWith("/")) continue;

    const classMatch = attributes.match(/\bclassName="([^"]*)"/);
    stack.push({ tag, classes: classMatch?.[1] ?? "" });
  }

  assert.ok(stack.length > 0, "Expected a JSX element containing the disclaimer");
  return stack.map((entry) => entry.classes).join(" ");
}

test("chat page reserves the fixed mobile navigation height", async () => {
  const source = await readSource("../../app/(student)/chat/page.tsx");

  assert.match(
    source,
    /h-full pb-\[calc\(var\(--student-mobile-nav-height\)\+env\(safe-area-inset-bottom,0px\)\)\] md:pb-0/,
  );
  assert.doesNotMatch(source, /\bpb-5\b/);
});

test("chat welcome fills the available space with the concise prompt", async () => {
  const source = await readSource("./chat-welcome.tsx");

  assert.match(source, /\bmin-h-full\b/);
  assert.match(source, /Where do you need to go\?/);
  assert.doesNotMatch(source, /Welcome to Campus SmartMap for VSU/);
});

test("chat input keeps mobile composer status readable without overlap", async () => {
  const source = await readSource("./chat-input.tsx");
  const textareaClasses = requiredMatch(
    source,
    /<textarea\b[\s\S]*?\bclassName="([^"]*)"/,
    "the textarea class list",
  )[1];
  const promptLabelClasses = requiredMatch(
    source,
    /<label\s+htmlFor="chat-message"\s+className="([^"]*)"/,
    "the visible prompt label class list",
  )[1];
  const disclaimerRegionClasses = enclosingJsxClasses(
    source,
    "AI answers may be inaccurate. Verify important details.",
  );

  assert.match(
    source,
    /<div className="relative flex-1[^"]*">[\s\S]*?<div className="flex items-center justify-between gap-2">[\s\S]*?<label\s+htmlFor="chat-message"[^>]*>[\s\S]*?\{isLimitReached \? "Daily chat limit reached" : placeholder\}[\s\S]*?<\/label>[\s\S]*?\{typeof remaining === "number" && \([\s\S]*?<span className="[^"]*\bfont-medium\b[^"]*\btext-foreground\b[^"]*">[\s\S]*?\{remaining > 0 \? `\$\{remaining\} chats left` : "Limit reached"\}[\s\S]*?<\/span>[\s\S]*?<\/div>[\s\S]*?<textarea[\s\S]*?\bid="chat-message"/,
  );
  assert.doesNotMatch(textareaClasses, /\bpr-24\b/);
  assert.match(textareaClasses, /\btext-base\b/);
  assert.match(promptLabelClasses, /\btext-foreground\b/);
  assert.doesNotMatch(promptLabelClasses, /\btext-muted-foreground\b/);
  assert.match(source, /<label\s+htmlFor="chat-message"/);
  assert.match(
    source,
    /<div className="absolute bottom-2 right-3[^"]*\btext-foreground\b[^"]*">\s*\{value\.length\}\/\{maxLength\}\s*<\/div>/,
  );
  assert.doesNotMatch(
    source,
    /(?:chats left|Limit reached)[\s\S]{0,200}\btext-muted-foreground\b/,
  );
  assert.match(source, /className="h-11 w-11 shrink-0"/);
  assert.match(
    source,
    /<\/form>\s*<div className="mt-1\.5 text-xs text-muted-foreground">\s*AI answers may be inaccurate\. Verify important details\.\s*<\/div>\s*<\/div>\s*\);\s*}/,
  );
  assert.doesNotMatch(disclaimerRegionClasses, /\b(?:absolute|fixed)\b/);
  assert.doesNotMatch(disclaimerRegionClasses, /\btext-red(?:-\S+)?\b/);
  assert.doesNotMatch(
    disclaimerRegionClasses,
    /\b(?:items-center|justify-between|flex-wrap)\b/,
  );
});
