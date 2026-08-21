# Supabase auth hardening: leaked-password protection

Issue: #60. Supabase can reject sign-ups and password changes whose password
appears in the HaveIBeenPwned breach corpus. The setting is hosted-project
configuration (Pro plan and above); it is not part of `supabase/config.toml`
and cannot be enabled through migrations.

## Enable on the hosted project

Either path works; the script is preferred because it is auditable and
idempotent.

### Option A — management API (script)

```bash
export SUPABASE_ACCESS_TOKEN=...   # personal access token with project access
export SUPABASE_PROJECT_REF=...    # ref from the Supabase dashboard URL
node tools/ops/enable-leaked-password-protection.mjs
```

The script prints the previous value, PATCHes
`password_hibp_enabled = true` through `PATCH /v1/projects/{ref}/config/auth`,
verifies the response, and exits non-zero if the API does not confirm.

### Option B — dashboard

1. Open the Supabase dashboard for the production project.
2. Go to Authentication → Security → Passwords (labelled "Passwords" under
   Authentication settings).
3. Turn on **Prevent use of leaked passwords** and save.

## Verify

- Re-run the script; it should print `Already enabled; nothing to do.`
- Or read back the config:

  ```bash
  curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth" \
    | grep password_hibp_enabled
  ```

- Functional check: attempt to register with a breached password such as
  `password123`; sign-up must be rejected with a leaked-password error, while
  an unbreached password succeeds.

## User-visible behavior

- Sign-ups and password updates that use breached passwords fail with an auth
  error surfaced through the existing auth error handling.
- Existing sessions are unaffected; only new credential creation/changes are
  checked.
- If the project is on the Free plan, the dashboard shows the setting as
  unavailable — upgrade before enabling.
