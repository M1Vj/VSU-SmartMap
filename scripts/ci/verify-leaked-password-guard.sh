#!/usr/bin/env bash
set -euo pipefail
WF='.github/workflows/security.yml'
fail=0
[[ -f "$WF" ]] || { echo "::error::$WF not found"; exit 1; }
grep -qi 'gitleaks' "$WF" || { echo '::error::secret scanner (gitleaks) missing from security.yml'; fail=1; }
grep -q 'concurrency:' "$WF" || { echo '::error::concurrency group (single-flight) missing from security.yml'; fail=1; }
grep -Eq 'cancel-in-progress:\s*true' "$WF" || { echo '::error::concurrency must set cancel-in-progress: true'; fail=1; }
if [[ "$fail" -ne 0 ]]; then echo '::error::leaked-password protection guard has drifted; see docs/security/leaked-password-guard.md'; fi
exit "$fail"
