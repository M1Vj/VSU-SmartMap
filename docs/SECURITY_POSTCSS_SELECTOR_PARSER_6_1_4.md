# Security dep-bump: postcss-selector-parser 6.1.2 -> 6.1.4

## Scope disclosure (atomic-PR split)

This PR is a lockfile-only security bump (`package-lock.json`):

- `node_modules/postcss-selector-parser`: `6.1.2` -> `6.1.4`
- `resolved`: `https://registry.npmjs.org/postcss-selector-parser/-/postcss-selector-parser-6.1.4.tgz`
- `integrity`: `sha512-bIoJLOmjCO1S9XdY/DcnR5hJxvrDir1PbGChrzXG3vw0/FOliy/fA3dmdhQ441kah4gKv+TwckGzex6wNS5cnQ==`
- `dev: true`, `license: MIT` unchanged.

The unrelated test harness bundled in the prior revision is **removed from
this PR and must be reviewed separately, if at all**:

- `tools/test-setup.ts` is **deleted** (119-line global `mock.module`
  reanchoring via `Error().stack` regex plus synthetic
  `globalThis.navigator` stub). It masked the documented toolchain instead of
  enforcing it, risked wrong-module mocking, and diverged from the native
  Node 22 `navigator` descriptor.
- `tools/run-tests.mjs` is **reverted** to the committed runner (no
  `--import ./tools/test-setup.ts`) plus a minimal hermetic fail-fast guard
  that refuses Node < 22 with a clear message. No mocking, no shimming.
- No `package.json` engines change: `engines.node >= 22` and CI Node 22 pin
  (`quality.yml`, `security.yml`) are already correct and are now enforced
  instead of shimmed. Node 20 is not supported; adding it would require an
  explicit engines/CI change plus first-class tests, not hidden patching.

`package-lock.json` itself is retained unchanged from the bump (correct hash
above) and is not re-emitted here to avoid duplicating the full lockfile.

## CVE-2026-9358 assessment (SNYK-JS-POSTCSSSELECTORPARSER-16873882)

- NVD marks `6.1.0-6.1.2` and `7.1.0-7.1.2` affected and `6.1.3`/`7.1.3`
  unaffected; Snyk advises upgrading to `6.1.3`, `7.1.2` or higher.
  `6.1.4` therefore remediates the listed CVE.
- Upstream history: `#316` added the `maxNestingDepth` guard (default 256)
  bounding parenthesis nesting during parsing and recursion during
  pseudo serialization / `walk` / `clone`, released as `7.1.2` and backported
  as `6.1.3`. `7.1.3` ("Improve fix (clone/walk)") and `6.1.4` ("tolerate
  non-node children when serializing", the `7.1.4` equivalent fixing the
  `replaceWith(array)` -> `child._stringify is not a function` regression
  from `#316`) complete the fix line. Code inspection of the published
  tarballs confirms `6.1.4` and `7.1.6` carry the identical guard pattern:
  `MAX_NESTING_DEPTH = 256` with `Cannot walk` / `Cannot clone` /
  `Cannot parse selector: nesting depth exceeds ...` catchable `Error`s and
  the `_stringifyChild` -> `String(child)` fallback.
- Hermetic PoC against the locally installed `6.1.4` (see
  `tools/verify-postcss-selector-parser.mjs`, no network):
  - depth 10 `:not(...)` nesting parses and round-trips;
  - depth 300 and 5000 throw catchable `Error: Cannot parse selector:
    nesting depth exceeds the maximum of 256`, never `RangeError`;
  - `root.first.first.replaceWith(["x"]); root.toString()` yields `"x"`.
- Run: `node tools/verify-postcss-selector-parser.mjs` (gated: set
  `SKIP_POSTCSS_VERIFY=1` to skip with an explicit reason on jobs without a
  lockfile install; otherwise fail-fast).

## GHSA-rj75-hqrm-r3gf assessment (why not 7.1.6)

- `7.1.6` (2026-09-03) fixes quadratic flat-selector parsing in linear time
  (`uniqs` changed from `filter`/`indexOf` to `Set`; plus `7.1.5`
  namespace/whitespace correctness fixes). There is **no 6.x backport**;
  `6.1.4` remains quadratic on flat inputs.
- Local measurement (same machine, real parser): flat class lists parse in
  `6.1.4 ~15/93/676ms` vs `7.1.6 ~16/16/60ms` for `2k/10k/30k` selectors,
  confirming the residual but bounded cost on 6.x.
- Staying on `6.1.4` is deliberate and safe for this repository:
  - `tailwindcss@3.4.17` (pinned via `tailwindcss ^3.4.1`) declares
    `"postcss-selector-parser": "^6.1.2"`. Moving to `7.x` is a major bump
    that breaks the Tailwind 3 line and requires a Tailwind v4 migration,
    which is out of scope for a security dep-bump.
  - The dependency is dev/build-time (`dev: true` in the lockfile): Tailwind
    runs at build time over first-party authored CSS. There is no
    attacker-controlled selector string at runtime and no long-lived service
    where CPU exhaustion would constitute a DoS. Practical impact is low,
    consistent with the maintainer's Tailwind exposure analysis.
  - Follow-up (not this PR): track Tailwind v4 / `postcss-selector-parser`
    `7.x` migration to inherit the linear-time parser; re-evaluate if any
    runtime untrusted-selector path is ever introduced.

## Version-matrix verification (shim removed)

On the required toolchain the suite needs no shim. The prior shim made
Node 20 green-but-wrong; the corrected behavior is fail-fast on Node 20.

| toolchain | harness | expected result |
| --- | --- | --- |
| Node 22 (`engines >= 22`, CI pin) without shim | reverted `run-tests.mjs` | `npm test` runs deterministically; `mock.module("@/...")` reaches the tsx resolve hook natively and intercepts the real `@/` modules; no test skipped or stubbed |
| Node 20 without shim | reverted `run-tests.mjs` | fail-fast with `Refusing to run tests on v20... Node >= 22 is required`; `ERR_MODULE_NOT_FOUND` for `@/` mocks and missing `globalThis.navigator` are the correct signals of the unsupported toolchain, not bugs to shim |
| Node 20 with old shim | deleted `test-setup.ts` | no longer applicable; the shim's stack-regex reanchoring and synthetic `navigator: { onLine, userAgent, hardwareConcurrency, language }` are removed because they changed mock identity and production `typeof navigator` guard semantics |
| Node 22 with old shim | deleted `test-setup.ts` | no longer applicable; unproven specifier rewriting risk removed |

No regression tests are added for the deleted bootstrap because there is no
retained bootstrap logic to test. `tools/test-file-discovery.mjs` already
handles the one legitimate cross-version difference first-class
(`toNodeTestArgument` glob escaping on Node 22 vs literal paths on Node 20)
without touching module identity or globals.

## CI hermeticity

- `quality.yml` and `security.yml` already pin `setup-node node-version: 22`
  with `npm ci` and run `npm test` / `npm audit --omit=dev`. The added
  `run-tests.mjs` Node guard makes a wrong-toolchain checkout fail locally
  with the same message instead of producing misleading green output.
- `tools/verify-postcss-selector-parser.mjs` is hermetic (local files only)
  and explicitly gated (`SKIP_POSTCSS_VERIFY=1` prints a skip reason and
  exits 0); all other failures exit non-zero. Existing fail-fast guards
  (`No test files found`, spawn error/signal handling, sensitive-file
  policy, `npm ci --ignore-scripts` install check) are preserved.