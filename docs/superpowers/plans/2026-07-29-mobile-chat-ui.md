# Mobile Chat UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the poor mobile Chat empty state with a compact assistant workspace and eliminate the credit/navigation gap and line at every mobile safe-area size.

**Architecture:** Keep the existing Chat hooks, message rendering, quota, offline state, and global student shell. Correct the shell’s shared measurements, then restyle only the presentational Chat components with existing semantic tokens. Protect the geometry and key mobile usability details with fast source-level regression tests, followed by real browser measurements.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Radix ScrollArea, Lucide icons, Node test runner, Playwright browser verification.

---

### Task 1: Add failing mobile layout regressions

**Files:**
- Create: `components/chat/chat-mobile-layout.test.ts`
- Modify: `components/layout/site-credit.test.ts`
- Modify: `components/student-tabs.test.ts`

- [ ] **Step 1: Write the failing Chat layout test**

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path: string) =>
  readFile(new URL(path, import.meta.url), "utf8");

test("mobile chat reserves only the shared credit row", async () => {
  const source = await readSource("../../app/(student)/chat/page.tsx");
  assert.match(source, /pb-5/);
  assert.doesNotMatch(source, /\bpb-20\b/);
});

test("empty chat is compact, useful, and fills its scroll viewport", async () => {
  const source = await readSource("./chat-welcome.tsx");
  assert.match(source, /min-h-full/);
  assert.match(source, /Where do you need to go\?/);
  assert.doesNotMatch(source, /Welcome to Campus SmartMap for VSU/);
});

test("composer keeps mobile text legible and accuracy copy in flow", async () => {
  const source = await readSource("./chat-input.tsx");
  assert.match(source, /\btext-base\b/);
  assert.match(source, /AI answers may be inaccurate/);
  assert.doesNotMatch(source, /absolute bottom-full/);
  assert.doesNotMatch(source, /text-red-/);
});
```

- [ ] **Step 2: Tighten the credit and navigation expectations**

Update `site-credit.test.ts` to require:

```ts
assert.match(
  source,
  /var\(--student-mobile-nav-height\)/,
);
assert.doesNotMatch(source, /5\.25rem/);
```

Update `student-tabs.test.ts` to require:

```ts
assert.doesNotMatch(source, /border-t border-border\/80/);
assert.match(source, /var\(--student-mobile-nav-height\)/);
```

- [ ] **Step 3: Run the focused tests and verify they fail**

Run:

```bash
npm test -- components/chat/chat-mobile-layout.test.ts components/layout/site-credit.test.ts components/student-tabs.test.ts
```

Expected: FAIL on the old `pb-20`, `5.25rem`, navigation border, welcome copy, floating warning, and mobile textarea size.

### Task 2: Unify the credit/navigation geometry

**Files:**
- Modify: `app/(student)/chat/page.tsx`
- Modify: `components/layout/site-credit.tsx`
- Modify: `components/student-tabs.tsx`

- [ ] **Step 1: Correct the shared measurements**

Define the shared base height once:

```css
/* app/globals.css */
--student-mobile-nav-height: 4.5625rem;
```

Then use:

```tsx
// app/(student)/chat/page.tsx
<div className="h-full pb-5 md:pb-0">
```

```tsx
// components/layout/site-credit.tsx
"mb-[calc(var(--student-mobile-nav-height)+env(safe-area-inset-bottom,0px))]"
```

- [ ] **Step 2: Remove the mobile seam**

Change the bottom-navigation wrapper to:

```tsx
"md:hidden fixed inset-x-0 bottom-0 z-50 min-h-[calc(var(--student-mobile-nav-height)+env(safe-area-inset-bottom,0px))] bg-background/95 backdrop-blur pb-[calc(16px+env(safe-area-inset-bottom,0px))] pt-2 transition-transform duration-300"
```

Use the same token and safe-area fallback for the map's right-side Leaflet
attribution. Keep the left-side map controls at their existing `5rem`
clearance.

- [ ] **Step 3: Run the focused shell tests**

Run:

```bash
npm test -- components/layout/site-credit.test.ts components/student-tabs.test.ts components/chat/chat-mobile-layout.test.ts
```

Expected: shell geometry assertions PASS; Chat presentation assertions remain FAIL.

### Task 3: Build the compact assistant workspace

**Files:**
- Modify: `components/chat/chat-header.tsx`
- Modify: `components/chat/chat-view.tsx`
- Modify: `components/chat/chat-welcome.tsx`
- Modify: `components/chat/suggestion-chips.tsx`
- Modify: `components/chat/chat-input.tsx`

- [ ] **Step 1: Make the header concise**

Keep `Campus Assistant` as the only page heading, remove its repeated subtitle,
and retain the conditional clear action with an accessible label.

```tsx
<header className="flex min-h-14 items-center justify-between px-4 py-2.5 sm:px-6">
  <h1 className="text-base font-semibold tracking-tight sm:text-lg">
    Campus Assistant
  </h1>
  {hasMessages && (
    <Button variant="ghost" size="sm" onClick={onClear}>
      <Trash2 className="mr-2 h-4 w-4" aria-hidden />
      Clear chat
    </Button>
  )}
</header>
```

- [ ] **Step 2: Replace the oversized welcome**

Use a viewport-filling, bounded stack:

```tsx
<section className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-5 py-6 text-center sm:px-6">
  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
    <MapPin className="h-5 w-5" aria-hidden />
  </div>
  <h2 className="mt-4 text-balance text-xl font-semibold tracking-tight">
    Where do you need to go?
  </h2>
  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
    Find campus buildings, offices, services, and nearby places.
  </p>
  <div className="mt-5">
    <SuggestionChips
      onSelect={onSuggestionSelect}
      disabled={disabled}
    />
  </div>
</section>
```

- [ ] **Step 3: Turn suggestions into useful actions**

Render the three existing questions as full-width, left-aligned buttons on
mobile with a small arrow icon, `min-h-11`, visible focus rings, and a
two-column-capable desktop layout.

```tsx
<div className="grid gap-2 text-left sm:grid-cols-2" role="region" aria-label="Suggested questions">
  {suggestions.map((suggestion) => (
    <button
      key={suggestion}
      type="button"
      onClick={() => onSelect(suggestion)}
      disabled={disabled}
      className="group flex min-h-11 items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-2.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span>{suggestion}</span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
    </button>
  ))}
</div>
```

- [ ] **Step 4: Rebuild the composer metadata**

Keep the textarea behavior, but use a `text-base md:text-sm` field, a
`h-11 w-11` send action, and one in-flow metadata row:

```tsx
<div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-[11px] text-muted-foreground">
  <span>AI answers may be inaccurate. Verify important details.</span>
  <span>{remaining} of {limit} chats left today</span>
</div>
```

The limit-reached text remains destructive and descriptive. Remove the
absolute red warning entirely.

- [ ] **Step 5: Run all focused Chat and shell tests**

Run:

```bash
npm test -- components/chat components/layout/site-credit.test.ts components/student-tabs.test.ts app/\(student\)/layout.test.ts
```

Expected: PASS.

### Task 4: Verify the finished behavior

**Files:**
- Modify only if verification finds a concrete defect.

- [ ] **Step 1: Run static and unit gates**

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Run the real app and inspect mobile geometry**

Start the app on port 3000 and verify `/chat` at 375x667 and 390x844. Measure
that the credit border box bottom equals the navigation border box top at both
safe-area 0 and a simulated 34px inset. Confirm no full-width line, no
horizontal overflow, suggestions above the fold, a 16px focused textarea, and
working send/clear/message states.

- [ ] **Step 3: Check desktop**

At 1440x900, confirm the inline navigation remains unchanged, the mobile
navigation is hidden, the Chat content stays bounded, and the composer aligns
with the conversation.

- [ ] **Step 4: Review the diff and commit**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: only the planned Chat, credit/navigation, tests, spec, and plan files
are changed. Commit with:

```bash
git add app/\(student\)/chat/page.tsx components/chat components/layout/site-credit.tsx components/layout/site-credit.test.ts components/student-tabs.tsx components/student-tabs.test.ts docs/superpowers
git commit -m "fix(chat): polish mobile assistant layout"
```
