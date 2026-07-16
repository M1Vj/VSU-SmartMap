# Campus SmartMap for VSU

Smart, offline-friendly campus navigation for Visayas State University. Browse facilities, search rooms, navigate with real walking routes, find verified off-campus boarding houses, chat with an AI assistant, and manage everything through a secure admin console.

![Campus SmartMap for VSU Banner](public/vsu-banner-21x9.png)

## Quick Links
- Map: `/`
- Boarding houses: `/boarding-houses`
- Directory: `/directory`
- Events: `/events`
- Chat: `/chat`
- Owner console: `/owner`
- Admin: `/admin`
- Offline page: `/offline`

Project policies: [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) ·
[Governance](GOVERNANCE.md) · [Data and assets](docs/DATA_AND_ASSETS.md)

## Overview
- Interactive map (OpenFreeMap vector + Esri satellite with place/road labels) with category pins, smart pin declutter, and a selection sheet
- Turn-by-turn walking navigation on a campus path graph, with nearest-gate handoff to real road routing for off-campus starts
- Boarding houses: owner-submitted, admin-verified off-campus listings with multi-room offerings, photos, amenities/safety checklists, reviews, price-anomaly flagging, routed walk times, and student filters
- Directory with search/filter and map handoff; campus events calendar
- AI chat assistant (Gemini via Genkit) with API-key rotation, model fallback ladder, answer caching, per-IP rate limits, and boarding-house awareness
- Interactive per-page guides (spotlight tours) for students, owners, and admins
- User suggestions (add/edit) with admin review and approval
- Offline-ready PWA with cached tiles/data and an offline landing page
- Admin dashboard for facilities/rooms CRUD, boarding-house moderation, navigation graph editing, and AI knowledge management
- Accessibility-focused (keyboardable tabs, focus rings, ARIA labelling)

## Tech Stack
- Next.js 16 (App Router, Turbopack), React 19, TypeScript
- Tailwind CSS + shadcn/ui, lucide-react
- Supabase (Postgres + RLS, Auth, Storage)
- Leaflet + MapLibre GL (vector basemap bridge with a project-owned React adapter)
- Genkit + Google Gemini for chat

## Requirements
- Node.js 22+
- npm 10+
- Docker Desktop, Colima, or another Docker-compatible runtime
- Supabase CLI (the project scripts run the pinned CLI with `npx`)
- Gemini API keys (optional; required only for AI chat)
- Map tiles need no key (OpenFreeMap + OSM/CARTO/Esri public endpoints)

## Getting Started
1. Install the locked dependencies.
   ```bash
   npm ci
   ```
2. Start and reset the project-local Supabase stack, create synthetic fixture
   accounts, and generate an ignored loopback `.env.local`.
   ```bash
   npm run dev:bootstrap
   ```
3. Run the app.
   ```bash
   npm run dev
   ```

The bootstrap refuses non-loopback Supabase URLs and never needs maintainer or
hosted-project credentials. If `.env.local` already targets a hosted project,
move it aside before bootstrapping; the script will not overwrite it.

## Supabase Setup
- Local configuration is committed in `supabase/config.toml` and uses PostgreSQL 17.
- `npm run db:reset` applies every migration and `supabase/seed.sql` only to the local stack.
- `npm run qa:seed` refreshes synthetic boarding-house fixtures; it refuses hosted Supabase URLs.
- See `docs/storage-bucket.md` for the exact public/private bucket contract.

## Environment Variables
Notes:
- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only (never expose it in the client).

```
NEXT_PUBLIC_SUPABASE_URL=...           # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...      # Supabase anon/publishable key
SUPABASE_SERVICE_ROLE_KEY=...          # Service role key (admin actions)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...     # Cloudflare Turnstile site key
TURNSTILE_SECRET_KEY=...               # Cloudflare Turnstile server secret
ABUSE_RATE_LIMIT_PEPPER=...            # Long random server-only value
BREAK_GLASS_ADMIN_USER_IDS=...         # Comma-separated auth user ids that always resolve as admin
NEXT_PUBLIC_GEOAPIFY_KEY=...           # (optional) walking-route provider — see Routing below
NEXT_PUBLIC_ORS_KEY=...                # (optional) OpenRouteService key — alternative provider
GEMINI_API_KEYS=key1,key2,...          # Comma-separated Gemini API keys (rotated per request)
GEMINI_MODEL_IDS=gemini-3.1-flash-lite,gemini-3.5-flash,gemini-2.5-flash-lite,gemini-2.5-flash  # Ordered fallback ladder (lite-first for free-tier quota)
```

### Routing (walking directions + boarding-house walk times)
Off-campus navigation and the boarding-house "walking time" use a real walking
router. With **no key**, requests use the keyless **OSRM-DE** foot router
(`routing.openstreetmap.de`) — works out of the box but is a community demo
(~1 req/s, no SLA, non-commercial), so under load some results fall back to a
labelled straight-line estimate. For production, set **one** free key
(precedence: Geoapify → OpenRouteService → OSRM):

- **Geoapify** (recommended) — https://geoapify.com. Free, no card, 3000/day.
  Restrict the key to your domain in the dashboard, then set `NEXT_PUBLIC_GEOAPIFY_KEY`.
  Keep the "Powered by Geoapify" attribution.
- **OpenRouteService** — https://account.heigit.org. Free, no card, 2000/day,
  cleanest self-host path. Set `NEXT_PUBLIC_ORS_KEY`. Its key can't be
  domain-locked, so prefer it for low-traffic / non-commercial use.

On-campus routing runs on an admin-editable path graph (nodes/edges with gate
nodes marking the external↔internal handoff); routes from outside campus enter
through whichever gate minimizes total detour.

## Scripts
- `npm run dev` — start Next.js (Turbopack)
- `npm run db:start` — start the isolated local Supabase stack
- `npm run db:reset` — reset only the local database and apply migrations/seeds
- `npm run dev:bootstrap` — start/reset local Supabase and create safe fixtures
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint
- `npm test` — unit tests (node:test via tsx)
- `npm run qa:rls` — adversarial RLS smoke test against loopback Supabase
- `npm run ai:dev` — start Genkit dev server

## Project Structure
- `app/(student)` — student-facing map, boarding houses, directory, events, chat, info, offline
- `app/owner` — boarding-house owner console (listings, offerings, photos, vacancy)
- `app/admin` — admin shell: facilities/rooms CRUD, boarding-house moderation, navigation editor, AI knowledge
- `app/api` — API routes (chat)
- `components` — shared UI/map/boarding-house/owner/admin/chat components
- `lib` — supabase clients, queries, context, constants, AI helpers, pathfinding
- `public/sw.js` — custom service worker for offline caching

## Offline & PWA
- Service worker caches static assets, map tiles (OpenFreeMap/OSM/CARTO/Esri hosts), and public Supabase facility/room endpoints
- Offline page at `/offline` with retry/back-to-map actions
- Facilities and chat history cached locally (with TTL/quotas)
- Manifest/icons included for installability; theme color matches brand green
- The Android app is a TWA wrapper around the deployed site, so web deploys update mobile automatically

## Roles & Access
- Students browse anonymously; writing reviews requires Google sign-in
- Boarding-house owners sign in with Google and manage listings at `/owner`; substantive edits to a live listing send it back to admin review
- Admin console at `/admin` (Supabase Auth email/password + break-glass allowlist)
- Server actions require `SUPABASE_SERVICE_ROLE_KEY`; RLS is the hard backstop for public reads

## Contributing
- Base branch: `main`; open a pull request from a focused branch
- Branch naming: `feature/<slug>`, `fix/<slug>`, `docs/<slug>`, or `chore/<slug>`
- Commits: Conventional Commits (`feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`, `chore(scope): ...`)
- Read `CONTRIBUTING.md`, keep PRs focused, and run the documented quality gates before opening a PR

## QA & Verification
- Lint: `npm run lint`
- Unit tests: `npm test`
- Types: `npm run typecheck`
- Build: `npm run build`
- RLS: `npm run qa:rls`
- Manual flows to verify before release:
  - Map load, pin selection/declutter at multiple zooms, category filter, search, navigation (on- and off-campus start)
  - Boarding houses: filters, detail page (photos zoom, room options, reviews), owner create/edit → admin review → publish
  - Directory search/filter and "View on Map" handoff; events list
  - Chat: send/stream responses, boarding-house questions, follow-ups, rate-limit messaging
  - Suggest add/edit flows and admin approval/rejection
  - Admin CRUD (facilities, rooms, images, history) and boarding-house moderation
  - Offline: visit `/offline`, toggle network to confirm cached tiles/data
  - PWA install prompt on mobile/desktop

## Deployment Notes
- Ensure env vars are set in the hosting platform (Supabase + Gemini; routing key optional)
- Turbopack root is pinned in `next.config.ts` to avoid multi-lockfile resolution issues
- Use `npm run build && npm run start` for production runs

## License

Project-authored code and assets are available under the [MIT License](LICENSE).
University names, marks, third-party data, and external map services retain
their respective rights and terms.

## Troubleshooting
- Turbopack root warnings: already pinned via `turbopack.root` in `next.config.ts`
- Stale browser baseline warning: update `baseline-browser-mapping` (dev dep) if tooling requests
- Service worker cache misses: clear browser storage and revisit the map to warm caches
- Blank picker maps: Leaflet surfaces need raster tile URLs (`MAP_TILES.rasterStreetUrl`/`rasterDarkUrl`), not the MapLibre vector style URLs
