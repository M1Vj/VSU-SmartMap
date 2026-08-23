# Supabase auth hardening: leaked-password protection

Issue: #60. Supabase can reject sign-ups and password changes whose password
appears in the HaveIBeenPwned breach corpus. The setting is hosted-project
configuration (Pro plan and above); it is not part of `supabase/config.toml`
and cannot be enabled through migrations.

## Enable on the hosted project

Either path works; the script is preferred because it is auditable and
idempotent.

### Option A — management API (script)
