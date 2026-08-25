# Runbook — leaked-password protection drift guard

## Control statement

Supabase Auth leaked-password protection rejects passwords found in public breach corpora (HaveIBeenPwned) at signup and at password set/change. `/admin` authenticates via Supabase Auth email/password plus a break-glass allowlist, so breached passwords are a direct credential-stuffing path into the highest-value console. The setting lives only in the hosted project's auth config and cannot be pinned in `supabase/config.toml` (supabase/cli#4620), so we enforce it as a continuously asserted invariant instead.

**Invariant:** `GET https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth` returns `password_hibp_enabled === true`.

Requires a Supabase Pro plan or above on the project.

## Components

| Path | Role |
| --- | --- |
| `tools/ops/enable-leaked-password-protection.mjs` | Existing manual enablement (PATCHes `password_hibp_enabled=true`) |
| `tools/ops/verify-leaked-password-protection.mjs` | Fail-closed assertion; exits 0 only when enabled |
| `.github/workflows/auth-config-drift-guard.yml` | Runs the assertion on schedule, dispatch, and when auth tooling changes |

## Required repository settings (Actions secrets and variables)

- **Variable** `SUPABASE_PROJECT_REF`: the 20-character project ref (non-secret).
- **Secret** `SUPABASE_ACCESS_TOKEN`: a dedicated personal access token used only for this read (`auth:read`). Do not reuse deploy/service tokens; rotate quarterly and immediately on suspicion of exposure.

The verifier deliberately logs only booleans and HTTP status. It must never print the token or the raw auth config, because that endpoint also returns secret-shaped fields (SMTP, SMS, provider secrets) — see the earlier incident fixed by "keep auth config values out of script logs".

## One-time enablement

1. Confirm the project plan supports leaked-password protection.
2. Run the enablement script as described in `docs/runbooks/supabase-auth-hardening.md` (or Dashboard → Authentication → Policies → "Leaked password protection").
3. Verify locally:
   `SUPABASE_PROJECT_REF=<ref> SUPABASE_ACCESS_TOKEN=<token> node tools/ops/verify-leaked-password-protection.mjs` → expect `PASS`, exit 0.
4. Add the variable and secret above so the scheduled guard turns green.

## Drift triage (workflow red)

1. Assume unauthorized auth-config change until proven otherwise.
2. Review Dashboard activity and who holds dashboard/owner access; correlate with recent merges touching auth tooling.
3. Re-enable (step 2 above), then re-run the workflow.
4. Force password reset for accounts created while protection was off before closing the incident.
5. Deliberate disablements are forbidden as silent ops: any intentional removal of this guard must land as a reviewed PR that updates this runbook's decision log with rationale and approver.

## Known limitations

- Scheduled workflows are disabled automatically by GitHub after ~60 days of default-branch inactivity; re-run via `workflow_dispatch` after dormant periods and monitor in patrol telemetry.
- The guard asserts; it does not auto-heal. Auto-healing would require a write-scoped token in CI and is intentionally rejected.
- HIBP checks apply to passwords set after enablement; pre-existing weak credentials still need forced reset (tracked separately).

## Decision log

- 2026-08-25: Enforcement + CI drift guard landed (PR #85, closes #60).