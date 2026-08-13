# Map Experiment Comparison Protocol

## Immutable inputs

- Base commit: `2841e4201a4fcda5228e663e7b18a0bf53449385` from `public/main`.
- Anonymous student map; no credentials or user data.
- Main Gate start: `10.7445449580544,124.792301058769`.
- On-campus destination: VSU Library from the same connected dataset/fixture in both runs.
- Viewports: 390x844, 412x915, 768x900, 1024x768, 1440x900.
- Page benchmark: 3 warmups and 30 samples.
- Browser load/interaction: 5 warmups and 30 samples when the automation surface supports repeatable throttling.
- Synthetic marker stress is reported separately at 100 and 500 markers, zoom 16 and 19; it never replaces production-count results.

## Metrics and correctness gates

Report median, p95, and paired bootstrap 95% confidence interval for deltas. Call a performance change meaningful only when p95 changes by at least 10%, the absolute change is at least 2 ms, and the confidence interval excludes zero. Otherwise label it inconclusive.

Correctness requires:

- zero duplicate marker selections;
- zero unexpected full-dialog opens;
- zero route-blank sampled frames during zoom/replacement;
- zero marker-route-mode losses before explicit clear;
- zero facility or boarding-card/action-dock overlaps;
- all action targets at least 44x44 CSS pixels;
- no unexpected external-routing request for the on-campus fixture.

## Commands and artifacts

- `rtk npm run test`
- `rtk npm run typecheck`
- `rtk npm run lint`
- `rtk npm run build`
- `PERF_BASE_URL=<served-url> PERF_WARMUPS=3 PERF_SAMPLES=30 PERF_BUDGET_MS=50 rtk npm run perf:pages`
- focused commands recorded verbatim in the PR.

Attach or summarize JSON/CSV benchmark output, browser viewport matrix results, console/network health, commit/deployment SHA, browser version, cache/service-worker state, and any environmental limitation. Remote preview latency is reported, not forced through the local 50 ms budget. Provider/network failures are classified separately and excluded from app-latency aggregates.

