# App Observability Logging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic site-wide logging, separate actionable bug incidents, and expose admin triage/export tools.

**Architecture:** Store raw structured telemetry in `app_log_events` and derived actionable failures in `app_bug_incidents`. Client-side instrumentation captures page views, interactions, console/error events, unhandled promise rejections, and recent breadcrumbs; server-side instrumentation records request outcomes and important API failures. Admin users review and export incidents from a new `/admin/logs` page while the existing manual `/admin/bugs` flow remains intact.

**Tech Stack:** Next.js App Router, React client providers, Supabase migrations/service-role writes, Node `node:test`, TypeScript utility modules, existing admin shell components.

---

### Task 1: Core Log Utilities

**Files:**
- Create: `lib/observability/logging.ts`
- Test: `lib/observability/logging.test.ts`

**Steps:**
1. Write failing tests for event sanitization, secret redaction, bounded metadata depth, severity classification, incident fingerprinting, and export serialization.
2. Run `rtk npx tsx --test lib/observability/logging.test.ts` and confirm the tests fail because the module does not exist.
3. Implement minimal typed helpers for log levels, event names, breadcrumbs, incidents, sanitization, fingerprinting, and export payloads.
4. Run the focused test again and confirm it passes.

### Task 2: Supabase Schema

**Files:**
- Create: `supabase/migrations/20260706100000_app_observability_logs.sql`

**Steps:**
1. Add `app_log_events` for structured raw telemetry.
2. Add `app_bug_incidents` for deduplicated actionable failures.
3. Add indexes for timestamp, severity, status, fingerprint, route, source, and request/session IDs.
4. Enable RLS with admin-only read/update policies; writes go through service-role API routes.
5. Verify SQL syntax with Supabase CLI where available.

### Task 3: Ingestion and Export APIs

**Files:**
- Create: `app/api/logs/route.ts`
- Create: `app/api/admin/logs/export/route.ts`
- Create: `lib/observability/server.ts`

**Steps:**
1. Accept allowlisted telemetry from the browser, sanitize it server-side, insert raw log events, and upsert bug incidents for important events.
2. Add helper functions for server code to record structured events without exposing secrets.
3. Add admin-only export route for JSON and CSV incident bundles with surrounding breadcrumbs/context.
4. Confirm non-admin access is rejected.

### Task 4: Global Capture Hooks

**Files:**
- Create: `components/observability/app-logging-provider.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/error.tsx`
- Modify: `app/global-error.tsx`
- Modify: `components/error-boundary.tsx`
- Modify: `proxy.ts`

**Steps:**
1. Add a global provider that generates a session ID, keeps recent breadcrumbs, and posts bounded batches to `/api/logs`.
2. Capture page views, clicks/submits on semantic targets, online/offline, console warnings/errors, `error`, and `unhandledrejection`.
3. Connect React and Next.js error boundaries to explicit critical log capture.
4. Add request timing/status headers in `proxy.ts` where feasible without logging request bodies.

### Task 5: Admin Logs Page

**Files:**
- Create: `app/admin/logs/page.tsx`
- Create: `components/admin/logs/logs-dashboard.tsx`
- Modify: `components/admin/admin-sidebar.tsx`
- Optionally modify: `lib/help/guides.tsx`

**Steps:**
1. Build a production admin page with summary counts, filters, incident list, selected incident details, context breadcrumbs, and copy/export actions.
2. Add sidebar navigation with an appropriate icon.
3. Keep the existing `/admin/bugs` manual report page unchanged except for shared types if necessary.

### Task 6: Verification

**Commands:**
- `rtk npx tsx --test lib/observability/logging.test.ts`
- `rtk npm run typecheck`
- `rtk npm run lint`
- `rtk supabase db lint` or a local migration syntax check if the CLI/project is available

**Manual checks:**
- Start the dev server.
- Trigger a client log event and a forced client error.
- Confirm the admin logs page renders and export links respond.
- Confirm logs do not include request bodies, auth tokens, passwords, or raw cookies.
