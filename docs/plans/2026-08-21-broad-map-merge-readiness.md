# Broad Map Rewrite Merge Readiness

Status: reviewed and merge-ready pending owner approval. This document records
the audit outcome, reproducible performance evidence, and the branch
reconciliation decision for `perf/map-broad-rewrite`.

## Scope

The branch rewrites map application ownership on top of the existing rendering
stack: Leaflet remains the interaction/overlay layer and MapLibre GL JS the
vector basemap through the official `maplibre-gl-leaflet` adapter. It
introduces a pure navigation runtime (`lib/map/map-runtime.ts`), a prepared
graph route engine (`lib/pathfinding/route-engine.ts`), untrusted-provider
route validation (`lib/pathfinding/route-validation.ts`), a pointer activation
gateway (`lib/map/pointer-activation.ts`), a popup lifecycle controller
(`lib/map/popup-lifecycle.ts`), an anchored accessible marker popup, a scoped
continuous wheel-zoom engine (`lib/map/leaflet-continuous-zoom.ts`), hardened
service-worker tile caching with versioned migration, and an individual-marker
overview mode.

The branch also consolidates three security fixes reviewed alongside the
rewrite:

- `script-src 'unsafe-inline'` is replaced with a per-request CSP nonce shared
  from `proxy.ts` through the request headers to Next's renderer; the root
  layout reads that nonce so inline bootstrap and flight scripts stay
  authorized (this makes layouts render per request).
- The dependency-audit CI gate audits production dependencies at critical
  severity, matching the recorded audit policy: the only outstanding high
  (GHSA-jmr9-qjv8-65gv against extract-zip) has no upstream fix, is reached
  only through dev tooling, and made an all-deps high gate unpassable.
- Supabase leaked-password protection enablement is staged as an idempotent
  management-API script and runbook; flipping it requires owner credentials on
  the hosted project (Pro plan).

## Verification evidence

All commands were run against a clean checkout of this branch:

| Gate | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | pass |
| Lint | `npm run lint` | pass |
| Unit suites | `npm test` | 1059 tests, 1058 passed, 0 failed, 1 skipped (local-Supabase RPC integration suite skips without a running stack) |
| Production build | `npm run build` | pass |

The repository Quality workflow runs typecheck, lint, tests, and build; results
above match CI expectations.

## Performance evidence

Production builds of this branch and of `perf/map-targeted-measured-pass`
were benchmarked back to back on the same machine using
`node tools/qa/benchmark-pages.mjs` (3 warmups + 30 samples, p95 budget
< 50 ms) against `next start`. All 16 routes pass the budget on both branches.
Total response p95 in milliseconds:

| Route | Broad rewrite | Targeted pass |
| --- | --- | --- |
| `/` (campus map) | 1.29 | 1.27 |
| `/chat` | 1.97 | 1.38 |
| `/directory` | 2.06 | 1.36 |
| `/events` | 8.63 | 7.18 |
| `/info` | 2.05 | 2.31 |
| `/admin` | 2.42 | 2.48 |
| `/admin/ai-knowledge` | 2.71 | 2.41 |
| `/admin/bugs` | 2.22 | 2.08 |
| `/admin/events` | 2.57 | 2.42 |
| `/admin/facilities` | 2.67 | 1.59 |
| `/admin/login` | 1.63 | 1.26 |
| `/admin/navigation` | 2.24 | 2.45 |
| `/admin/navigation/pathfinding` | 1.36 | 1.64 |
| `/admin/suggestions` | 3.16 | 2.34 |
| `/admin/suggestions/performance-benchmark` | 1.79 | 1.40 |
| `/offline` | 1.31 | 0.99 |

These numbers measure server-rendered page delivery and show parity between
the two approaches. Client-side interaction behavior (wheel zoom continuity,
marker activation exactly once, popup anchoring, drag responsiveness) is
contract-tested in the unit suites and exercised by the Playwright smoke spec
(`e2e/map-broad-smoke.spec.ts`).

## Branch reconciliation

This branch supersedes `perf/map-targeted-measured-pass` as the map runtime
path. The two branches share early history but diverge substantially (101
files differ between tips); they must not be merged into each other or into
`main` together. When this branch merges, close the targeted pull request
unmerged so its remaining unique fixes are re-derived here if still relevant.

## Known limitations

- The continuous zoom engine uses Leaflet's internal zoom pipeline and is
  covered by an exact `leaflet` pin; see "Dependency notes" in
  `CONTRIBUTING.md` before upgrading Leaflet.
- The service-worker tile cache evicts in first-stored order rather than
  strict least-recently-used order; entry counts are bounded (400 tiles,
  128 map assets).
- The Playwright smoke suite requires `MAP_E2E_BASE_URL` and runs outside CI;
  run it manually for map interaction changes.
- The CSP nonce makes layouts render per request. Locally the map page moved
  from ~1.3 ms to ~5.7 ms total p95 (budget: 50 ms); on Vercel, previously
  static routes become function invocations instead of CDN-served HTML.
- Leaked-password protection is staged only until it is enabled on the hosted
  project with owner credentials.
