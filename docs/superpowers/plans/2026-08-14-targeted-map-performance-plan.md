# Targeted Measured Map Performance Implementation Plan

1. Establish baseline measurements from the clean production-base checkout and capture the precise mobile gesture/route-state event sequence.
2. Add failing tests for pointer/touch compatibility-event deduplication, one-tap selection, inert mini-card title, Details-only expansion, route replacement success/failure/stale completion/explicit clear, and split route-action layout across facility and boarding-house card heights and safe-area insets.
3. Fix marker gesture ownership without changing desktop popup, clustering, keyboard, or manual-start semantics.
4. Harden route continuity at the current coordinator boundary so pending/stale calculations never blank the last successful overlay or disable route-mode dots.
5. Extract a responsive bottom-center route action dock; keep status and metrics top-center and coordinate clearance with the mini card and mobile safe area.
6. Add bounded performance marks/counters and a repeatable map-interaction benchmark where they answer the comparison questions.
7. Run the exact commands and artifact protocol in `../specs/2026-08-14-map-experiment-comparison-protocol.md`, collect before/after measurements, independently review the branch, and open an unmerged PR to public `main`.
