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
npm run qa:rls:schedules
node tools/qa/rls-authenticated-student-hardening.mjs
```

Use Conventional Commits and explain user-visible behavior, data provenance,
security impact, and verification evidence in the pull request. New campus data
or media must follow `docs/DATA_AND_ASSETS.md`. Report vulnerabilities through
`SECURITY.md`, not a public issue.

Pull requests must come from a branch, stay current with `main`, pass every
required Quality, Security, and CodeQL check, and resolve all review threads.
Repository owners may close changes that bypass data provenance, privacy,
dependency review, or least-privilege requirements.

## Dependency notes

`leaflet` is pinned to the exact released version (no caret range) because
`lib/map/leaflet-continuous-zoom.ts` intentionally drives Leaflet's internal
zoom pipeline (`_limitZoom`, `_limitCenter`, `_moveStart`, `_move`, `_moveEnd`)
and fails fast at startup if that internal surface changes. When upgrading
Leaflet:

1. Update the pin and lockfile together.
2. Run `npm test`; the continuous-zoom suite exercises the internal API contract.
3. Manually verify wheel zooming, keyboard zoom, and pinch behavior on the
   campus map before merging.

The map Playwright smoke suite (`npm run test:map-e2e`) requires a deployed
app exposed through `MAP_E2E_BASE_URL` and intentionally fails closed when the
variable is missing. It is not part of CI; run it manually for changes that
affect map interaction, controls, or popups.
