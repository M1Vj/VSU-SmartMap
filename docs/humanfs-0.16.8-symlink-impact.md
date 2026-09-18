# @humanfs/node 0.16.7 -> 0.16.8 / @humanfs/core 0.19.1 -> 0.19.2 impact analysis

## Decision

Keep this PR atomic: lockfile bump only. The unrelated `tools/run-tests.mjs`
Node >= 22 auto re-exec harness (+123/-4, toolcache scan, `which` probing,
`spawnSync` re-exec, `VSU_TEST_NODE` / `VSU_TEST_ALLOW_NODE20` /
`VSU_TEST_REEXEC` contract) is intentionally **not** in this PR. It is
deferred to a separate PR with design review, an allowlist with path
validation, CI-variable provenance, and dedicated unit tests. `tools/run-tests.mjs`
in this PR retains only a hermetic fail-fast engine guard (no filesystem
scan, no `which`, no alternate-binary execution).

## What changed upstream

- `@humanfs/node` 0.16.7 -> 0.16.8 patches
  **GHSA-p498-v437-472g** (Moderate 5.7, CWE-22: symlink `copyFile`
  dereference file-disclosure in `copy()` / `copyAll()`, fixed by upstream
  commit `22bbaa4`). `copy()` now does `lstat` + `readlink` + `symlink` when
  the source is a symlink instead of delegating unconditionally to
  `fs.promises.copyFile()` (which dereferences). `copyAll()` now branches on
  `entry.isSymlink` first and recreates the link, recursing only for real
  directories.
- `@humanfs/core` 0.19.1 -> 0.19.2 (symlink copy-as-symlink semantics +
  runtime `@humanfs/types` dependency).
- New runtime dependency `@humanfs/types` 0.15.0 (Apache-2.0, engines
  `>=18.18.0`).
- License (Apache-2.0), maintainer (`nzakas`), and `engines >= 18.18.0`
  unchanged. Dev-only scope in this repo limits blast radius.

## Lockfile integrity (registry.npmjs.org, sha512)

- `@humanfs/node` 0.16.8:
  `gE1eQNZ3R++kTzFUpdGlpmy8kDZD/MLyHqDwqjkVQI0JMdI1D51sy1H958PNXYkM2rAac7e5/CnIKZrHtPh3BQ==`
- `@humanfs/core` 0.19.2:
  `UhXNm+CFMWcbChXywFwkmhqjs3PRCmcSa/hfBgLIb7oQ5HNb1wS0icWsGtSAUNgefHeI+eBrA8I1fxmbHsGdvA==`
- `@humanfs/types` 0.15.0:
  `ZZ1w0aoQkwuUuC7Yf+7sdeaNfqQiiLcSRbfI08oAxqLtpXQr9AIVX7Ay7HLDuiLYAaFPu8oBYNq/QIi9URHJ3Q==`

Verify with `npm ci` / `npm audit` / `npm ls @humanfs/node @humanfs/core @humanfs/types`.

## Symlink-behavior impact on VSU-SmartMap

- **Direct usage audit:** VSU-SmartMap has no direct dependency on
  `@humanfs/*`. The packages arrive transitively via dev tooling (eslint
  stack). No `app/`, `components/`, `lib/`, `hooks/`, or API-route code
  imports `@humanfs/node`, `@humanfs/core`, or `@humanfs/memory`, and no
  production path calls `copy()` / `copyAll()` on attacker-controlled trees.
  Grep the repo for `from "@humanfs` / `require("@humanfs` to confirm; the
  expected result is tooling-internal references only.
- **Behavioral delta:** any future caller that copies a tree containing a
  symlink now gets a symlink at the destination (same `readlink` target)
  rather than a regular file containing the target's bytes. Code that read
  the copied file's *contents* through the old dereference behavior must now
  resolve the link explicitly. Code that assumed copies were self-contained
  is now safer: the pre-0.16.8 behavior could pull arbitrary readable host
  files into the output (file-disclosure primitive); the fixed behavior
  preserves the link boundary.
- **Risk:** low. Security-positive patch bump. `npm install` / `build` /
  `test` passing on the bump is expected; the new regression test below pins
  the fixed semantics so a future downgrade fails loudly.

## Regression coverage

- `tools/humanfs-symlink-regression.test.ts` (discovered via `TEST_ROOTS`
  `tools`, pattern `\.test\.tsx?$`):
  - `copy()` preserves a symlink as a symlink (`lstat.isSymbolicLink()`,
    `readlink` target preserved).
  - `copyAll()` keeps an inner symlink as a symlink and does not materialise
    outside bytes as a regular file (fails on < 0.16.8, passes on 0.16.8).
  - `copyAll()` preserves nested-directory symlinks.
  - Hermetic and explicitly gated: uses only `node:` builtins plus
    `os.tmpdir()` scratch dirs cleaned with `rm -r --force` (logged on
    failure); no network, no Supabase, no external binaries. If
    `@humanfs/node` is not resolvable the tests `t.skip()` with a clear
    reason instead of failing. No empty catches: every catch logs.
- Run: `npm test` (Node 22+, `npm 10+`) or
  `node --experimental-test-module-mocks --import tsx --test tools/humanfs-symlink-regression.test.ts`.

## CI / engine guard contract

- `package.json` `engines`: `node >= 22`, `npm >= 10`.
- `tools/run-tests.mjs` is hermetic: checks only
  `process.versions.node` (robust `split(".")[0]` + `parseInt radix 10` +
  `Number.isInteger` validation, fail-fast on unparsable) and the single
  repository variable `VSU_TEST_ALLOW_NODE20`. No `spawnSync` / `execFileSync`,
  no `existsSync` / `readdirSync` scans, no `which`, no `VSU_TEST_NODE`, no
  `VSU_TEST_REEXEC`, no `process.kill(self, signal)` without a logged
  try/catch fallback.
- `VSU_TEST_ALLOW_NODE20=1|true|yes` bypasses the gate for local diagnosis
  only, logs a loud `WARNING` to stderr for audit, and must never be set in
  CI. All other values keep fail-fast `process.exit(1)` with an actionable
  message. There is no fail-open default.
- Threat model for refusing auto re-exec here: see the header comment in
  `tools/run-tests.mjs`. A follow-up PR may propose discovery + re-exec only
  with an allowlist, path validation, CI-variable provenance, loop-guard
  tests, and docs.

## Verification checklist

1. `npm ci` installs `@humanfs/node@0.16.8`, `@humanfs/core@0.19.2`,
   `@humanfs/types@0.15.0` with the hashes above.
2. `npm test` on Node 22+ passes, including the three symlink regression
   tests.
3. `VSU_TEST_ALLOW_NODE20=1 npm test` on Node 20 runs with a logged warning
   (local diagnosis only); without it, `tools/run-tests.mjs` fails fast.
4. `npm run lint`, `npm run typecheck`, `npm run build` pass.
5. No `tools/run-tests.mjs` diff beyond the hermetic guard; full file (not a
   truncated hunk) is available for review.