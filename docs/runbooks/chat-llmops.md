# Campus Chat LLMOps Runbook

This runbook covers the student Campus Assistant control plane. Treat stored transcripts as sensitive operational data: use the admin Chat Ops surface, do not copy them into email, tickets, or general logs.

## Service objectives and release gates

| Signal | Objective | Immediate gate |
| --- | --- | --- |
| Usable outcomes, rolling 30 days | At least 99.5% | Investigate a sustained burn or fallback spike |
| Live AI outcomes, rolling 30 days | At least 99.0% | Investigate provider/model exhaustion |
| Live end-to-end p95 latency | Below 12 seconds | Investigate latency alert and model attempts |
| Hard reference validation | 100% pass | P0; stop promotion |
| Scheduled synthetic | No two consecutive failures | Respond after the second consecutive failure |

The deterministic golden suite is the pull-request gate. Every P0 invariant must pass. A live-provider evaluation is diagnostic only and must never replace deterministic reference, safety, and abstention checks.

## Alert response

1. Open `/admin/chat-ops` from the alert and confirm the release ID, outcome, fixed error class, request ID, and time window. Alert messages intentionally contain no transcript.
2. Check whether the fingerprint is isolated or rising. Claims are deduplicated in 15-minute buckets, so one email can represent multiple visible failures.
3. Compare usable outcome, live outcome, p95 latency, validation failures, static/disabled fallback, and negative-feedback counts for the current and previous release.
4. If reference validation can reach students, or failures are broad and continuing, activate the kill switch. If only one model is degraded, preserve evidence and follow the configured model-ladder response before rollback.
5. Record the decision and affected release/request IDs in the incident record. Never paste transcript or credentials into it.

Telemetry and notification failures are secondary incidents: they must not change an already determined student answer. Request validation, authorization, quota, and output validation remain fail-closed.

## Trace triage

In Chat Ops, filter by request ID or turn ID, then confirm:

- release, requested/selected model, attempt count, and live/cache/recovered/generated-fallback/static-fallback/disabled-fallback/error outcome;
- retrieval IDs and domains, validation result/reasons, injection signals, cache state, latency, and time to first token;
- sanitized question/answer and any linked anonymous feedback;
- neighboring failures on the same release and error class.

Do not infer a provider failure from a fallback alone: distinguish disabled fallback, cache behavior, output-validation rejection, provider exhaustion, and telemetry-write failure. Export only the minimum bounded JSON or spreadsheet-safe CSV needed for an incident.

## Feedback review

Review negative feedback daily and filter first by release and reason (`incorrect`, `outdated`, `wrong location`, `unhelpful`, `unsafe`, or `other`). Move items through `unreviewed`, `reviewing`, and either `resolved` or `dismissed`. Validate an alleged factual error against an approved source before changing retrieval data or a golden fixture. Escalate repeated `unsafe` reports immediately; aggregate other repeated failures into a candidate eval case without copying personal text.

## Kill switch and rollback

Set the server-side deployment variable `CHAT_LLM_ENABLED=false` and redeploy the affected environment to bypass providers. Verify a new turn has outcome `disabled_fallback`, uses the deterministic static facility-aware fallback, and still writes a sanitized trace. Do not expose the variable through `NEXT_PUBLIC_*`.

For a code rollback, redeploy the last known-good production deployment whose release ID and deterministic eval report passed. Keep the kill switch off only after the synthetic probe succeeds and Chat Ops shows valid live outcomes. Database rollback is separate: do not drop LLMOps tables or disable RLS during an application rollback. Prefer a forward migration if schema repair is required.

## Retention and privacy

Sanitized chat turns and feedback are retained for 90 days; alert claims are retained for 30 days. Generic operational logs have their own policy. The daily retention job invokes the bounded, idempotent service-only purge and reports deleted counts. Investigate repeated purge failures without granting browser access or bypassing RLS. Never retain raw authorization material, tokens, emails, phone numbers, JWT-like values, or obvious secrets in an eval fixture.

## Eval promotion

Run the offline gate without provider keys or network access:

```bash
node tools/evals/run-chat-evals.mjs > chat-eval-report.json
```

The command exits nonzero on any P0 failure and emits one JSON report. Before promoting a new case:

1. Reproduce a real behavior or approved requirement, then rewrite all fixture entities and facts as self-contained synthetic data.
2. Assign P0 to deterministic safety, canonical-reference, domain-separation, abstention, and unsafe-link invariants; use P1 for diagnostic quality coverage.
3. Review the expected relevant IDs, canonical ID/name/domain triples, prohibited phrases, and allowed domains. Keep the case deterministic and provider-independent.
4. Run the focused evaluator tests and the complete fixture. Review Recall@K, MRR, per-case failures, and the JSON schema.
5. Promote only with reviewer approval. Never encode an unverified claim about a real facility as expected truth.

## Firing the synthetic test

The `Chat synthetic health` workflow runs at 17 and 47 minutes past each hour and also supports manual dispatch. Configure the canonical deployment origin in the repository variable `PRODUCTION_URL` and the same server-only `CHAT_HEALTH_SECRET` in both GitHub Actions secrets and the production deployment. The workflow supplies the protected token without displaying it. For an authorized local diagnostic, keep the token out of shell history and send it in the `x-chat-health-secret` header expected by `/api/health/chat`. The probe forces a bounded live generation, bypasses the public answer cache, and requires a nonblank reference-valid response. Its JSON response contains operational metadata only, never the generated transcript or credentials.

After firing, verify the workflow result, release ID, selected model when safely reportable, and latency. If synthetic-turn persistence is enabled later, also verify the matching trace and request ID; the endpoint does not fabricate feedback or identity credentials. A malformed structured result, validation failure, timeout, or non-2xx response is a failed probe. The workflow retries transient failures no more than twice; two consecutive scheduled failures trigger alert response. To test the failure path, use only an approved maintenance window, confirm the failure contains no transcript or credential, then prove the next live probe passes.
