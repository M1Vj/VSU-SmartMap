# Targeted Measured Map Performance Implementation Plan

1. Establish baseline measurements from the clean production-base checkout and capture the precise mobile gesture/route-state event sequence.
2. Add failing tests for one-tap selection, inert mini-card title, Details-only expansion, route retention during recalculation/zoom, and split route-action layout.
3. Fix marker gesture ownership without changing desktop popup, clustering, keyboard, or manual-start semantics.
4. Harden route continuity at the current coordinator boundary so pending/stale calculations never blank the last successful overlay or disable route-mode dots.
5. Extract a responsive bottom-center route action dock; keep status and metrics top-center and coordinate clearance with the mini card and mobile safe area.
6. Add bounded performance marks/counters and a repeatable map-interaction benchmark where they answer the comparison questions.
7. Run focused and full static/runtime verification, collect before/after measurements, independently review the branch, and open an unmerged PR to public `main`.

