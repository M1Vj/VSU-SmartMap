# Campus Chat LLMOps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Supabase-native, secure, observable, evaluable, and alerting LLMOps layer around the Campus Assistant chat.

**Architecture:** The chat route remains the orchestration boundary but delegates request validation, safety signals, response grounding, and telemetry persistence to focused `lib/ai/ops` modules. Server-only Supabase tables store sanitized turns, anonymous feedback, and deduplicated alert claims; the existing admin and notification systems expose and alert on those records. A secret-protected synthetic route and repository-owned eval suite test live and deterministic behavior.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Genkit 1.x with Gemini, Supabase/Postgres RLS, Vercel Cron/deployment, GitHub Actions, Node test runner, Zod 4.

---

### Task 1: Database contracts, RLS, and retention

**Files:**
- Create: `supabase/migrations/20260801044444_chat_llmops.sql`
- Test: `lib/ai/ops/migration.test.ts`
- Modify: `app/api/cron/storage-retention/route.ts`
- Modify: `app/api/cron/storage-retention/route.test.ts`

- [ ] Write a failing migration test asserting the three tables, indexes, RLS, admin-only read/review policies, no browser insert policy, service-only alert claim and purge functions, fixed search paths, bounded deletion, and notification-event backfill.
- [ ] Run `rtk proxy npx tsx --test lib/ai/ops/migration.test.ts` and confirm it fails because the migration is absent.
- [ ] Run `rtk proxy npx supabase migration new chat_llmops`, implement the schema from the design, and add `chat_ops_alert` to every existing notification recipient exactly once.
- [ ] Extend the daily retention route to call the bounded LLMOps purge RPC and include deleted counts without exposing database errors.
- [ ] Run the focused migration/cron tests and confirm they pass.

### Task 2: Secure chat request boundary and durable quota

**Files:**
- Create: `lib/ai/ops/request.ts`
- Create: `lib/ai/ops/request.test.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `lib/ai/rate-limit.ts`
- Modify: `lib/ai/rate-limit.test.ts`

- [ ] Write failing tests for JSON content type, 32 KiB streamed-body cap, 250-character message, six history entries of at most 1,200 characters, 1,200-character summary, valid UUID conversation ID, NUL/control-character rejection, and generic errors.
- [ ] Write failing tests proving chat uses `consumeRateLimit` with fixed limits/bucket and fails closed when durable quota is unavailable.
- [ ] Implement a Zod request contract over the shared bounded request reader and replace the in-memory limiter in the route.
- [ ] Preserve 429 `Retry-After`, SSE/non-SSE behavior, and the current six-chat UI semantics.
- [ ] Run the focused request, quota, and route tests.

### Task 3: Prompt boundaries, release identity, cache safety, and output validation

**Files:**
- Create: `lib/ai/ops/release.ts`
- Create: `lib/ai/ops/safety.ts`
- Create: `lib/ai/ops/grounding.ts`
- Create: `lib/ai/ops/release.test.ts`
- Create: `lib/ai/ops/safety.test.ts`
- Create: `lib/ai/ops/grounding.test.ts`
- Modify: `lib/ai/flows/find-location.ts`
- Modify: `lib/ai/prompts/campus-assistant.ts`
- Modify: `lib/ai/answer-cache.ts`
- Modify: `lib/ai/answer-cache.test.ts`
- Modify: `components/chat/chat-markdown.tsx`
- Modify: `components/chat/chat-markdown.test.ts`

- [ ] Write failing tests for stable release identity, bounded injection signals, segregated prompt blocks, canonical ID/name validation, invalid-reference removal/failure, PII/secret-like cache exclusion, release-aware hashes, and rejection of `//host` Markdown links.
- [ ] Implement pure helpers with low-cardinality outcomes; keep the detector informational and enforce safety through schema/allowlists.
- [ ] Change prompt assembly so user/history/retrieved data is serialized under explicit non-instruction labels.
- [ ] Validate structured output against the exact retrieved facility/event/listing records before caching or returning cards.
- [ ] Run all focused safety, grounding, cache, and Markdown tests.

### Task 4: Durable turn tracing and model metadata

**Files:**
- Create: `lib/ai/ops/types.ts`
- Create: `lib/ai/ops/sanitize.ts`
- Create: `lib/ai/ops/sanitize.test.ts`
- Create: `lib/ai/ops/server.ts`
- Create: `lib/ai/ops/server.test.ts`
- Modify: `lib/ai/genkit.ts`
- Modify: `lib/ai/genkit.test.ts`
- Modify: `lib/ai/flows/find-location.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `app/api/chat/streaming.ts`
- Modify: `app/api/chat/streaming.test.ts`

- [ ] Write failing tests for transcript redaction, bounded metadata, selected-model/attempt propagation, live/cache/recovered/generated-fallback/static-fallback/error modes, request/turn/release correlation, time-to-first-token, and telemetry-write failure isolation.
- [ ] Extend key/model rotation results with selected model and attempt metadata without exposing API keys or provider payloads.
- [ ] Add a per-request trace accumulator that is finalized exactly once for every route outcome, including SSE close/error paths.
- [ ] Return `turnId`, `feedbackToken`, `outcome`, and `requestId` in final structured payloads and `x-request-id` response headers.
- [ ] Persist sanitized transcripts and operational metadata through the service role after the student response is determined.
- [ ] Run focused Genkit, route, streaming, sanitizer, and persistence tests.

### Task 5: Anonymous feedback and student UI

**Files:**
- Create: `app/api/chat/feedback/route.ts`
- Create: `app/api/chat/feedback/route.test.ts`
- Create: `components/chat/chat-feedback.tsx`
- Create: `components/chat/chat-feedback.test.ts`
- Modify: `lib/types/chat.ts`
- Modify: `hooks/use-chat.ts`
- Modify: `components/chat/chat-message.tsx`

- [ ] Write failing tests for UUID/token/rating/reason/comment validation, token hashing, one-row upsert semantics, mismatched-token denial, bounded rate limiting, no-store responses, and accessible feedback controls.
- [ ] Implement feedback persistence using the opaque per-turn token; never authorize anonymous feedback by turn ID alone.
- [ ] Add compact thumbs-up/down controls under completed assistant answers, reason chips for negative feedback, optional short comment, saved/retry states, keyboard labels, and no layout shift in the mobile composer.
- [ ] Preserve feedback metadata in local chat history without storing the opaque token in generic telemetry.
- [ ] Run focused API, hook, and component tests.

### Task 6: Admin Chat Ops dashboard and exports

**Files:**
- Create: `app/admin/chat-ops/page.tsx`
- Create: `app/admin/chat-ops/actions.ts`
- Create: `app/api/admin/chat-ops/export/route.ts`
- Create: `components/admin/chat-ops/chat-ops-dashboard.tsx`
- Create: `lib/ai/ops/admin.ts`
- Create: `lib/ai/ops/admin.test.ts`
- Modify: `components/admin/admin-sidebar.tsx`
- Modify: `components/admin/admin-sidebar.test.ts`
- Modify: `lib/observability/logging.ts`
- Modify: `lib/observability/logging.test.ts`

- [ ] Write failing tests for admin authorization, bounded DTO mapping, 24-hour metric aggregation, p50/p95 calculation, filters, review-state updates, JSON export, and CSV formula neutralization.
- [ ] Implement server-side bounded queries and safe DTOs; keep service-role access out of the client component.
- [ ] Build summary cards, filters, transcript/metadata detail, feedback/review controls, retention notice, and exports.
- [ ] Add Chat Ops to desktop/mobile admin navigation and keep existing Logs as the generic incident surface.
- [ ] Run admin, export, sidebar, and CSV tests.

### Task 7: Deduplicated alerts and health checks

**Files:**
- Create: `lib/ai/ops/alerts.ts`
- Create: `lib/ai/ops/alerts.test.ts`
- Create: `app/api/health/chat/route.ts`
- Create: `app/api/health/chat/route.test.ts`
- Create: `.github/workflows/chat-synthetic.yml`
- Modify: `lib/notifications/routing.ts`
- Modify: `lib/notifications/routing.test.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `.env.example`

- [ ] Write failing tests for fixed alert fingerprints, atomic 15-minute claims, best-effort email, transcript-free notification bodies, notification routing, constant-time secret verification, live-outcome semantic validation, timeout, no-store, and synthetic trace marking.
- [ ] Implement alert claims and `chat_ops_alert` routing through existing recipient/provider infrastructure.
- [ ] Add a secret-protected health route that forces a bounded live generation and fails on cache/fallback/invalid output.
- [ ] Add a least-privilege scheduled/manual workflow with two bounded retries, a canonical URL variable, secret header, and runbook link.
- [ ] Run alert, notification, health-route, and workflow contract tests.

### Task 8: Golden evaluations and runbooks

**Files:**
- Create: `tools/evals/chat-golden.v1.jsonl`
- Create: `tools/evals/run-chat-evals.mjs`
- Create: `lib/ai/ops/eval.ts`
- Create: `lib/ai/ops/eval.test.ts`
- Create: `docs/runbooks/chat-llmops.md`
- Modify: `package.json`
- Modify: `.github/workflows/quality.yml`
- Modify: `README.md`

- [ ] Write failing evaluator tests for dataset schema, retrieval Recall@K/MRR, canonical ID validity, abstention, entity-domain separation, injection cases, and machine-readable reports.
- [ ] Commit a fixture-only dataset whose expected records are defined inside the fixture and do not depend on mutable production facts.
- [ ] Implement `npm run eval:chat` as a deterministic no-secret PR gate and an opt-in live mode for pre-release diagnostics.
- [ ] Add the deterministic gate to CI only when chat/prompt/retrieval/eval files change.
- [ ] Document SLOs, dashboards, alert response, trace investigation, feedback review, kill switch, rollback, retention, eval promotion, and synthetic test-firing.
- [ ] Run the deterministic eval suite and documentation link checks.

### Task 9: Verification, review, migration, and release

**Files:**
- Modify only files required by review findings.

- [ ] Run focused LLMOps tests and `rtk npm run test`.
- [ ] Run `rtk npm run typecheck`, `rtk npm run lint`, `rtk npm run build`, `rtk proxy npm audit --omit=dev`, and `rtk git diff --check`; triage reachable high/critical findings rather than applying breaking audit fixes blindly.
- [ ] Run `rtk proxy npx supabase --version`, inspect the changelog/security docs, run migration list and linked dry-run, apply the migration only after the SQL/RLS review passes, and verify with service/admin/anonymous queries.
- [ ] Run local browser checks at 320, 390, and desktop widths for chat, feedback, settings/navigation clearance, admin Chat Ops, keyboard access, and zero horizontal overflow.
- [ ] Test-fire live success, forced fallback, validation failure, feedback, alert deduplication, synthetic failure, and retention; remove synthetic rows created only for verification.
- [ ] Obtain an independent security/correctness review, address material findings, rerun all gates, commit atomically, push, open a public PR, merge after checks, mirror to private history, and verify the production deployment and exact merge SHA.
