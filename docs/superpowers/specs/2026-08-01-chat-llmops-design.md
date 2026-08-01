# Campus Chat LLMOps Design

**Status:** Approved by the owner's explicit autonomous-execution instruction  
**Date:** 2026-08-01  
**Scope:** Student-facing Campus Assistant chat, its operational data, administrator controls, and release verification

## Objective

Make the Campus Assistant observable, reproducible, safer against adversarial input, measurable for factual quality, and able to notify the project owner when the live AI path degrades. The system must preserve the current concise student experience and deterministic map/facility cards while adding the evidence needed to debug individual conversations and detect regressions across releases.

## Selected Approach

Use a Supabase-native LLMOps control plane integrated with the existing SmartMap observability, admin authorization, notification delivery, and Vercel deployment. Do not introduce Sentry, PostHog, Langfuse, or Google Cloud Monitoring in this iteration. The data contracts use OpenTelemetry GenAI-style names where practical so a future OTLP exporter can be added without redesigning storage.

This approach was selected over:

1. **A hosted LLM observability vendor.** Faster dashboards, but another vendor, credential set, privacy boundary, bill, and admin surface.
2. **Genkit Monitoring on Google Cloud.** Strong native traces and token metrics, but it requires Firebase Blaze, Google Cloud IAM/APIs, and input/output logging is enabled by default unless explicitly disabled.
3. **Supabase-native control plane (selected).** Best fit for the existing service-role ingestion, admin RLS, email notifications, incident exports, and ownership model.

## On-call Questions

Every stored signal must answer at least one of these questions:

1. Did the student receive a live, cached, recovered, or static-fallback answer, and why?
2. Which model, prompt release, retrieved campus records, and validation result produced this answer?
3. Is the live AI path becoming slower, more expensive, less grounded, or more negatively rated?
4. Can an administrator reproduce, classify, export, and resolve a reported wrong answer without searching hosting logs?

## Trust Boundaries and Threat Model

Untrusted input enters through the anonymous chat request, client-supplied history/summary, administrator-authored AI knowledge, provider output, and anonymous feedback. Valuable assets are Gemini quota and API keys, campus-information integrity, user conversation content, service-role database access, and admin operational data.

Controls follow these rules:

- The system prompt is guidance, not an authorization boundary.
- The model has no tools, writes, arbitrary URL fetches, SQL execution, or privileged actions.
- User/history/retrieved text is labeled as data and separated into explicit blocks.
- Request size, message length, history count and element length, summary length, JSON shape, and content type are enforced before model work.
- Durable server-side rate limiting replaces the process-local limiter. A client cannot select its own rate-limit bucket.
- Structured model output is validated against the exact retrieved identifiers and canonical names before cards or cached answers are accepted.
- Model text remains untrusted React text. Only single-slash same-origin paths may become links; protocol-relative links remain literal.
- Prompt-injection-like patterns are recorded as bounded signals for review, not treated as a perfect classifier or used as the only defense.
- Cache writes are skipped for input that looks personal or secret-bearing, and cache identity includes the behavior/data release instead of only the normalized question.

## Request and Trace Lifecycle

Each user turn receives:

- `request_id`: propagated from the request boundary and returned in response headers.
- `conversation_id`: a browser-generated UUID persisted with local chat history.
- `turn_id`: a server-generated UUID for this interaction.
- `release_id`: a stable hash/version binding code release, prompt version, model ladder, output schema, and retrieval/cache behavior version.
- `feedback_token`: a random opaque token returned only to that browser; only its hash is stored.

The server records one durable turn for cache hits, live responses, recovered partial streams, generated fallbacks, static fallbacks, validation failures, rate-limit failures after an accepted body, and internal errors. It records user content, assistant content, outcome, requested and selected model, attempt count, latency and time-to-first-token when available, token counts when exposed by Genkit, cache state, retrieved record identifiers/counts, output validation, injection signals, error class, and release metadata.

Transcript content is sanitized before persistence. Campus subjects, rooms, schedules, and ordinary questions remain useful and readable. Tokens, authorization material, email addresses, phone numbers, JWT-like strings, and obvious secrets are redacted.

The chat response includes the turn identifier and feedback token only in the final structured payload; they are not displayed as content.

## Storage, Access, and Retention

Create three server-written tables:

- `ai_chat_turns`: one sanitized transcript and operational record per turn.
- `ai_chat_feedback`: one current anonymous rating per turn/token with a bounded reason taxonomy and optional sanitized comment.
- `ai_chat_alert_claims`: deduplicates actionable notifications by fingerprint and time bucket.

RLS is enabled on all tables. Authenticated administrators may read turns and feedback. Only administrators may update review state. Browser clients receive no direct table policies; API routes use the service role after their own validation. Alert claims are server-only.

Retention:

- Sanitized transcripts and feedback: 90 days.
- Alert claims: 30 days.
- Existing generic operational log retention remains separate.
- The existing daily retention cron calls a bounded service-only cleanup RPC. Cleanup is idempotent and reports deleted counts.

## Correctness and Grounding

Correctness is measured at multiple layers:

1. **Deterministic response contract:** valid structured output, canonical returned IDs/names, maximum card counts, correct entity domain, and returned references drawn from the retrieved source set.
2. **Operational validation:** every turn stores `pass`, `warn`, or `fail` plus machine-readable reasons. A hard reference failure prevents the invalid references from reaching the user and cache.
3. **User feedback:** thumbs up/down on assistant replies. Negative feedback requires one bounded reason: incorrect, outdated, wrong location, unhelpful, unsafe, or other. A short optional comment is allowed.
4. **Golden regression suite:** repository-owned cases cover exact facility and room lookup, aliases, ambiguous/category searches, unsupported/abstention behavior, events, boarding-house separation, multilingual/Taglish phrasing, multi-turn context, direct injection, poisoned retrieved text, oversized inputs, and unsafe links.
5. **Release gate:** deterministic P0 invariants must be 100%. Live-provider evaluation is a scheduled/pre-release diagnostic, not a required PR secret and not judged solely by another LLM.

## Admin Chat Ops

Add `/admin/chat-ops` to the existing admin shell. It provides:

- 24-hour totals for live, cache, fallback, error, validation-failure, and negative-feedback outcomes.
- p50/p95 latency computed from bounded recent data.
- model/outcome/release filters.
- a turn queue with sanitized question, answer, retrieved entity IDs, injection/validation signals, error class, and request/turn IDs.
- feedback and review state (`unreviewed`, `reviewing`, `resolved`, `dismissed`).
- JSON and spreadsheet-safe CSV export.
- a visible data-retention statement and alert/notification status.

The dashboard must not fetch data client-side with service credentials. The server page asserts the existing admin role, loads bounded records, and passes safe DTOs to the client dashboard.

## Alerts and Synthetic Monitoring

Actionable alert fingerprints are claimed atomically per 15-minute bucket. Only the first claim sends the existing admin email event `chat_ops_alert`; later matching failures remain visible in Chat Ops without creating an email storm. Alert-worthy outcomes are:

- hard chat errors,
- provider/model exhaustion that reaches static fallback,
- hard output validation failure,
- repeated negative feedback on the same release category,
- a failed authenticated synthetic probe.

The email contains no transcript. It includes counts, outcome/error class, release ID, request ID, and a link to `/admin/chat-ops`.

Add a GitHub Actions synthetic workflow that runs every 30 minutes and on demand. It calls a dedicated production health route with a secret, forces a small live-model turn that bypasses the answer cache, validates the structured response and live outcome, retries transient failures twice, and fails the workflow if the live AI path is unavailable. The route is protected by a constant-time comparison to `CHAT_HEALTHCHECK_TOKEN` (falling back to the existing `CRON_SECRET` only when explicitly configured server-side), has a strict timeout, and stores the result as a synthetic trace. Repository/Vercel secret configuration is performed during rollout without printing the value.

Initial service objectives:

- usable chat outcomes: 99.5% over 30 days,
- live AI outcomes: 99.0% over 30 days,
- p95 end-to-end live latency below 12 seconds,
- hard output-reference validation: 100%,
- synthetic: no two consecutive failed scheduled runs.

## Failure Behavior and Kill Switch

`CHAT_LLM_ENABLED=false` bypasses the provider and uses the deterministic static facility-aware fallback while still recording the turn as `disabled_fallback`. This is the emergency cost/provider kill switch. User-facing errors remain generic. Provider error details are classified into a fixed low-cardinality taxonomy and never returned to the browser.

Telemetry and email are best-effort after the answer is determined: a storage or notification outage must not turn a valid campus answer into a student-visible failure. Security controls—input validation, rate limiting, authorization, and output validation—fail closed.

## Testing and Verification

The implementation follows red-green-refactor tests for:

- bounded request parsing and durable quotas,
- injection signal detection and prompt data segregation,
- transcript redaction and retention,
- output/reference validation,
- feedback token verification and taxonomy,
- alert deduplication and email routing,
- admin authorization/DTO/export behavior,
- synthetic authorization and semantic health checks,
- migration RLS/function grants,
- chat UI feedback states and accessibility.

Before completion: full tests, typecheck, lint, production build, dependency audit triage, migration list/dry-run/apply, local browser checks for chat/feedback/admin, synthetic failure injection, production deployment SHA verification, live production chat trace verification, admin trace verification, and cleanup of synthetic evidence created only for testing.

## Primary Sources

- NIST AI RMF 1.0: https://doi.org/10.6028/NIST.AI.100-1
- NIST Generative AI Profile: https://doi.org/10.6028/NIST.AI.600-1
- OWASP LLM01 Prompt Injection: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- OWASP LLM Top 10 2025: https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/
- OpenTelemetry GenAI attributes: https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/
- Genkit evaluation: https://genkit.dev/go/docs/evaluation/
- Genkit telemetry collection: https://genkit.dev/docs/js/observability/telemetry-collection/
- Genkit production monitoring configuration: https://genkit.dev/docs/js/observability/advanced-configuration/
- Vercel Cron management: https://vercel.com/docs/cron-jobs/manage-cron-jobs
- GitHub Actions scheduled workflows: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Supabase API security and RLS: https://supabase.com/docs/guides/api/securing-your-api

