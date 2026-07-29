# Mobile Chat UI Design

**Date:** 2026-07-29  
**Status:** Approved autonomously by the product owner  
**Primary implementation repo:** `M1Vj/VSU-SmartMap`  
**Mirror:** `M1Vj/VSU-SmartMap-private-history`

## Problem

The empty mobile Chat page repeats the same purpose twice, gives an oversized
welcome illustration and headline most of the available height, separates its
AI warning from the composer, and leaves the useful suggestion actions outside
the first useful reading path.

The developer credit and mobile navigation also use conflicting layout
reservations:

- the shared credit reserves `5.25rem` below itself;
- the fixed mobile navigation is `4.5625rem` tall before its safe-area inset;
- the navigation adds a top border; and
- the Chat route independently reserves `5rem` of bottom padding.

The 11px mismatch creates the empty band, the navigation border creates the
visible line, and the duplicate Chat padding wastes another 60px beyond the
20px credit row.

## Approaches considered

### A. Minimal spacing patch

Change only the two mismatched measurements and remove the navigation border.
This is low risk, but it leaves the duplicated, oversized Chat experience
unchanged.

### B. Compact assistant workspace

Keep the existing full-page Chat architecture and design tokens, but give the
screen one concise header, a smaller task-oriented empty state, useful quick
questions, and a unified composer. Align the shared credit exactly with the
navigation and retain it across all student pages.

### C. Map-backed assistant sheet

Present Chat as a sheet over the map. This is visually distinctive, but it
introduces keyboard, focus-trap, map-state, and facility-sheet conflicts that
are disproportionate to this correction.

## Decision

Implement approach B. It resolves the reported defect and improves the page
without changing Chat data, quotas, streaming, offline behavior, routing, or
the global visual language.

## Mobile layout

The screen remains a single vertical surface:

1. compact `Campus Assistant` header;
2. optional offline status;
3. scrollable conversation or empty state;
4. composer;
5. transparent 20px developer-credit row;
6. fixed student navigation.

The empty state uses a small map-pin mark, the heading “Where do you need to
go?”, one short supporting sentence, and three full-width quick-question
buttons. It is centered within the actual scroll viewport with bounded width
and responsive spacing. There is no second welcome-to-the-product headline.

The composer becomes a single calm panel. Its field uses a 16px mobile font to
avoid iOS input zoom, the send button has a 44px target, and the daily quota and
short accuracy reminder share one muted metadata row. The warning is no longer
red, floating, or emoji-led. The existing first-use disclaimer dialog remains
the detailed explanation.

## Credit and navigation contract

- The developer credit remains visible and links to `https://github.com/M1Vj`.
- Its mobile bottom margin is exactly
  `calc(4.5625rem + env(safe-area-inset-bottom))`, matching the navigation.
- The Chat page reserves only the credit row (`1.25rem`), not another
  navigation-height block.
- The mobile navigation has no top border or shadow that can render as a seam.
- Credit and navigation backgrounds remain visually continuous in light and
  dark themes.
- The existing map attribution contract remains unchanged.

## Desktop behavior

Desktop keeps the inline header navigation and does not reserve mobile
navigation space. The Chat content is centered within a readable maximum width
while still allowing message cards and horizontal facility results. The
composer spans the same content width as the conversation.

## Accessibility and interaction

- Keep one page-level `h1`.
- Preserve the conversation `role="log"`, live updates, retry actions, Enter to
  send, Shift+Enter for a newline, the 250-character limit, offline handling,
  and daily quota behavior.
- Suggestions remain native buttons with visible focus styles and at least
  44px touch targets.
- Icon-only actions keep accessible names.
- Offline and limit states remain understandable without color.
- Text and controls use existing semantic theme tokens for light/dark contrast.

## Verification

- Add source-level regression tests for the exact shared credit/navigation
  measurement, absence of the mobile navigation seam, compact Chat route
  reservation, non-floating accuracy copy, mobile input size, and bounded
  suggestion layout.
- Run focused tests, full tests, typecheck, lint, and production build.
- Verify the actual app in a browser at 375x667, 390x844, and desktop width,
  including a simulated 34px safe area.
- Measure a 0px credit-to-navigation gap, check no horizontal overflow, confirm
  the empty state and quick questions appear above the fold, and exercise
  typing/sending and the message state.
