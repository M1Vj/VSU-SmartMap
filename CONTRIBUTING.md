# Contributing

Thanks for helping improve Campus SmartMap. The project welcomes corrections,
accessibility improvements, tests, documentation, and carefully sourced campus
data.

## Development

1. Fork and clone the repository.
2. Run `npm ci`.
3. Run `npm run dev:bootstrap` to create an isolated local Supabase stack and
   synthetic fixture accounts.
4. Run `npm run dev` and make a focused change on a branch from `main`.

The bootstrap refuses hosted Supabase URLs. Never include `.env.local`, raw
source documents, personal exports, credentials, or generated tool state.

## Before a pull request

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run db:reset
node tools/dev/bootstrap-local.mjs --skip-env-file
npm run qa:rls
```

Use Conventional Commits and explain user-visible behavior, data provenance,
security impact, and verification evidence in the pull request. New campus data
or media must follow `docs/DATA_AND_ASSETS.md`. Report vulnerabilities through
`SECURITY.md`, not a public issue.
