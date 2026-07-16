# Architecture

Campus SmartMap is a Next.js application backed by Supabase. The public map,
directory, events, and verified boarding-house listings are readable without an
account. Owner and administrator workflows require Supabase Auth and database
roles enforced with Row Level Security (RLS).

## Trust boundaries

- The browser holds only public configuration and the Supabase anon key. It
  must not receive the service-role key, email credentials, or abuse-control
  secrets.
- Server actions validate input, authentication, authorization, CAPTCHA, and
  rate limits before using privileged database or storage operations.
- Supabase RLS remains the final authorization boundary for browser-accessible
  tables. Administrator status is stored in `app_user_roles`, not inferred from
  an email address or user-controlled metadata.
- Public uploads use short-lived, single-purpose intents and constrained object
  paths. Evidence buckets are private and retention-limited.
- External AI and routing providers receive only the request data needed for
  their feature. Gemini, hosted route-provider keys, email notifications,
  telemetry, cron jobs, and Vercel hosting are optional integrations; Supabase
  is required for the full application.

## Main data paths

1. Public reads use the anon client and RLS-filtered views/tables.
2. Authenticated owner actions use the signed-in session; RLS limits them to
   their own profile and listings.
3. Administrator actions resolve a server-verified role and use narrow service
   operations for moderation and storage.
4. Anonymous suggestions and reports pass CAPTCHA, rate limiting, schema
   validation, and bounded upload-intent checks before database writes.
5. Client telemetry is disabled on loopback and is privacy-sanitized and
   rate-limited when sent from a hosted application.

Local development uses the Supabase CLI configuration in `supabase/config.toml`.
`npm run dev:bootstrap` starts and resets only the project-local stack, creates
synthetic fixture accounts, and writes ignored loopback credentials.
