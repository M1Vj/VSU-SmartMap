# Leaked-Password Guard Runbook

## Purpose
CI must continuously prove no known-compromised credentials exist in the tree (`security.yml`, enforcement tracked under #86/#87).

## Failure signatures
- **Burst of identical security.yml failures seconds apart**: trigger fan-out without `concurrency`. Confirm runs share timestamps, then land/keep the concurrency group (`cancel-in-progress: true`). Do not re-run individually - it amplifies the storm.
- **Single gitleaks finding**: rotate the credential immediately, then purge history; never edit the allowlist to make the job pass.
- **Drift check failure** (`verify-leaked-password-guard.sh`): someone weakened the workflow; restore scanner + concurrency before merging anything else.

## Escalation
Any red security gate blocks all merges until triaged. Treat as P1 regardless of other CI state.
