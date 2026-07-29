# Changelog

## v1.6.0
- Add a private, offline-first student schedule with recurring meetings, next-class guidance, conflict warnings, and campus map handoff
- Share ranked facility name, code, alias, and room search between the campus map and schedule
- Add local JSON backup/restore and standards-compliant ICS calendar export
- Add Settings controls for student navigation visibility; Map, Schedule, Directory, and Chat are enabled by default
- Prevent stale route requests and competing map camera transitions during rapid navigation handoffs
- Make service-worker installation bounded and resilient, precache `/schedule`, and keep personal schedule data out of Cache Storage
- Add disabled-first, private account schedule sync setup and disclose explicit consent, sensitive exports, deletion tombstones, and rollback requirements
- Keep auth, API, Supabase REST/RPC, and non-GET requests network-only in the service worker

## v1.5.0
- Add boarding-house discovery with map/list views, listing details, reviews, and room options
- Add owner onboarding and listing management flows
- Add admin boarding-house moderation and management tools
- Improve AI chat grounding, answer caching, markdown rendering, and boarding-house responses
- Improve map labeling, pin decluttering, routing behavior, and in-app help guidance

## v1.2.5
- Standardize admin dialog layouts with a shared scaffold
- Fix bug report and room suggestion dialogs overflowing when images are attached
- Remove duplicate target facility label in suggestion review
- Allow clearing optional facility codes (store as NULL)

## v1.2.4
- Add image credits and contact fields for facilities and rooms
- Display photo credits in facility, room, and zoom views
- Extend admin and suggestion flows to capture credits and contacts
- Improve image uploads with adaptive compression and old-image cleanup
- Tighten facility sheet layout and reduce map pin size
- Bump facilities and service worker cache versions
- Fix offline cached map navigation loop on mobile
- Improve mobile geolocation reliability with low-accuracy fallback

## v1.2.3
- Fix chat page duplicate title suffix
- Add Turnstile captcha to bug report dialog
- Hide exposed database URLs in admin bug reports
- Force fresh data on admin dashboard for recent activity
- Add pinch-to-zoom gesture support for all image dialogs
- Improve image dialog mobile sizing (85vh height)
- Optimize dialog animations with GPU acceleration
- Add Google site verification meta tag

## v1.2.2
- Fix revalidate admin suggestions after submissions
- Fix preserve room suggestion fields when adding images
- Fix stabilize PH date formatting for hydration
- Fix fallback upload for suggestion images
- Fix suggestions flow and map loading hotfix
- Add Vercel Analytics
- Add Open Graph and Twitter card metadata

## v1.2.0
- Add Cloudflare Turnstile captcha to suggestion modals
- Add bulk reject action for admin suggestions
- Add Supabase realtime subscription for suggestions
- Add Philippine timezone date formatting
- Refactor Turnstile to use native API with idempotency support

## v1.1.0
- Add satellite map view toggle in settings
- Optimize mobile pinch-to-zoom smoothness
- Fix mobile modal stacking with Select z-index
- Fix RLS for public suggestion submissions
- Add CSS touch and GPU optimizations for mobile zoom
- Update branding icons

## v1.0.0
- Campus map with category pins, selection, and directory handoff
- Directory search/filter with URL sync and cached facilities
- AI chat assistant with streaming responses and facility matches
- User suggestion flows (add/edit) with admin approval and history tracking
- Admin console for facilities/rooms CRUD, image upload, and activity feed
- Offline-ready PWA: cached tiles/data, offline page, installable manifest
- Accessibility pass (focus handling, ARIA labels, keyboard nav)
- Performance tuning (lazy map loading, bundle analyzer, caching)
