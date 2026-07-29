# Mobile Chat and Settings Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put Chat status information inside the Chat surface, replace the mobile navigation-tab list with an inline disclosure, and move the mobile developer credit into Settings.

**Architecture:** `ChatInput` owns its quota, counter, and accuracy helper; the Chat route reserves the fixed mobile navigation independently of the global credit. `SettingsDropdown` owns a mobile-only disclosure and credit link, while `SiteCredit` remains visible on desktop and on public layouts without student navigation.

**Tech Stack:** Next.js App Router, React, TypeScript, Radix Dropdown Menu, Tailwind CSS, Node test runner, Playwright

---

### Task 1: Lock the Chat bottom-area contract

**Files:**
- Modify: `components/chat/chat-mobile-layout.test.ts`
- Modify: `app/(student)/chat/page.tsx`
- Modify: `components/chat/chat-input.tsx`

- [ ] **Step 1: Write failing source-contract tests**

Add assertions that the Chat route uses:

```tsx
pb-[calc(var(--student-mobile-nav-height)+env(safe-area-inset-bottom,0px))]
md:pb-0
```

Assert the quota copy is rendered inside the same relative wrapper as the textarea, uses the concise forms `chats left` and `Limit reached`, and is absent from the normal-flow accuracy-helper row.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
rtk proxy npx tsx --test components/chat/chat-mobile-layout.test.ts
```

Expected: failures for the old `pb-5` route spacing and quota below the form.

- [ ] **Step 3: Move the quota into the field and reserve mobile navigation**

Change the Chat route wrapper to:

```tsx
className="h-full pb-[calc(var(--student-mobile-nav-height)+env(safe-area-inset-bottom,0px))] md:pb-0"
```

Inside the bordered relative field wrapper, render a compact top row with the visible prompt label on the left and quota on the right whenever `remaining` is available. Use `6 chats left` or `Limit reached`. Render the full-width textarea below that row and keep the character counter independently positioned at the lower-right with sufficient bottom padding.

Keep this exact normal-flow helper after the form:

```tsx
<div className="mt-1.5 text-xs text-foreground">
  AI answers may be inaccurate. Verify important details.
</div>
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run the same focused test. Expected: all Chat mobile-layout tests pass.

- [ ] **Step 5: Commit the Chat refinement**

```bash
rtk git add 'app/(student)/chat/page.tsx' components/chat/chat-input.tsx components/chat/chat-mobile-layout.test.ts
rtk git commit -m "fix(chat): attach mobile status to composer"
```

### Task 2: Add the inline mobile Settings disclosure and credit

**Files:**
- Modify: `components/layout/settings-dropdown.test.ts`
- Modify: `components/layout/settings-dropdown.tsx`

- [ ] **Step 1: Write failing Settings tests**

Assert that mobile Settings includes:

```tsx
aria-expanded={mobileNavigationTabsOpen}
onSelect={(event) => {
  event.preventDefault();
  setMobileNavigationTabsOpen((open) => !open);
}}
```

Assert `NavigationTabItems` is conditionally rendered inline, desktop still uses `DropdownMenuSub`, and the GitHub developer link occurs after `Report a Bug`.

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
rtk proxy npx tsx --test components/layout/settings-dropdown.test.ts
```

Expected: failures for missing disclosure state and mobile developer link.

- [ ] **Step 3: Implement the disclosure**

Add local `mobileNavigationTabsOpen` state. Replace the always-expanded compact branch with a `DropdownMenuItem` that prevents selection dismissal, exposes `aria-expanded`, toggles the state, and rotates a `ChevronDown` icon. Conditionally render the existing `NavigationTabItems` directly below it.

- [ ] **Step 4: Add the final mobile-only credit item**

After the bug-report action, add a separator and a mobile-only `DropdownMenuItem asChild` containing:

```tsx
<a
  href="https://github.com/M1Vj"
  target="_blank"
  rel="noopener noreferrer"
>
  Developed by Vj F Mabansag
</a>
```

Keep it small, centered, contrast-safe, focusable, and last in source order.

- [ ] **Step 5: Run the focused test and confirm GREEN**

Run the focused Settings test. Expected: all Settings tests pass.

- [ ] **Step 6: Commit the Settings refinement**

```bash
rtk git add components/layout/settings-dropdown.tsx components/layout/settings-dropdown.test.ts
rtk git commit -m "fix(settings): collapse mobile navigation controls"
```

### Task 3: Remove the mobile global-credit strip

**Files:**
- Modify: `components/layout/site-credit.test.ts`
- Modify: `components/layout/site-credit.tsx`
- Modify: `app/(student)/layout.test.ts`

- [ ] **Step 1: Write failing credit-placement tests**

Replace the mobile-margin expectation with assertions that student-navigation routes use responsive visibility (`hidden md:flex`), do not reserve the mobile navigation height, and retain transparent desktop geometry. Preserve the offline/public-layout behavior when `reserveMobileNavigation` is false.

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
rtk proxy npx tsx --test components/layout/site-credit.test.ts 'app/(student)/layout.test.ts'
```

Expected: failure because the current footer uses a mobile bottom margin.

- [ ] **Step 3: Hide only the student-route mobile footer**

When `hasMobileNavigation` is true, apply responsive visibility that hides the footer below `md` and restores `flex` at `md`. Remove the mobile-navigation bottom margin. Keep the current desktop link, transparent background, dimensions, and root-route handling.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run the same focused tests. Expected: all credit/layout tests pass.

- [ ] **Step 5: Commit the credit placement**

```bash
rtk git add components/layout/site-credit.tsx components/layout/site-credit.test.ts 'app/(student)/layout.test.ts'
rtk git commit -m "fix(layout): move mobile credit into settings"
```

### Task 4: Verify behavior and responsive geometry

**Files:**
- No persistent test artifact files

- [ ] **Step 1: Run focused integration tests**

```bash
rtk proxy npx tsx --test components/chat/chat-mobile-layout.test.ts components/layout/settings-dropdown.test.ts components/layout/site-credit.test.ts 'app/(student)/layout.test.ts' components/student-tabs.test.ts components/map/map-wrapper.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run all static and test gates**

```bash
rtk npm test
rtk npm run typecheck
rtk npm run lint
rtk npm run build
rtk git diff --check
```

Expected: 708 or more tests pass; typecheck, lint, build, and diff check exit zero.

- [ ] **Step 3: Verify mobile Chat in a real browser**

At 320×568, 375×667, and 390×844 verify:

- composer and helper sit immediately above the fixed navigation;
- no global developer-credit strip or empty gap exists;
- quota is inside the field beside the visible prompt label and does not collide with typed multiline text, character count, or send button;
- accuracy helper remains readable and belongs to Chat;
- no horizontal overflow occurs.

- [ ] **Step 4: Verify mobile Settings**

Open Settings, confirm Navigation tabs is collapsed by default, expand it in place, toggle a non-required tab without closing the menu, and verify the GitHub credit is the final item. Confirm there is no nested popup.

- [ ] **Step 5: Verify desktop and map regressions**

At 1440×900 confirm the desktop global credit remains visible and transparent, desktop Navigation tabs still uses its submenu, and the map attribution and mobile map controls remain unchanged.

- [ ] **Step 6: Commit any verification-driven correction**

If runtime checks require a source correction, add a focused regression test, apply the smallest fix, rerun all gates, and commit with a scoped `fix:` message.

### Task 5: Review and ship

**Files:**
- Review the complete branch diff

- [ ] **Step 1: Request an independent read-only review**

The reviewer must inspect accessibility, mobile geometry, Radix menu behavior, desktop regressions, tests, and the full diff. Resolve every material finding with a regression test.

- [ ] **Step 2: Push and open the public pull request**

Push `fix/mobile-chat-settings-public`, open a PR to `M1Vj/VSU-SmartMap:main`, wait for GitHub Actions and Vercel checks, and inspect annotations.

- [ ] **Step 3: Merge and verify production**

Squash-merge the public PR, verify the production deployment SHA matches the merge commit, and repeat the key Chat and Settings checks at `https://vsumap.vercel.app`.

- [ ] **Step 4: Mirror to private history**

Create an isolated private-history worktree from its current `main`, cherry-pick the public squash commit, verify changed product files are byte-identical, run all gates, open and merge the private-history PR, and wait for its main CI.
