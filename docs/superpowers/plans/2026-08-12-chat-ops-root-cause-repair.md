# Chat Operations Root-Cause Repair Implementation Plan

## Task 1: Lock the execution contract with tests

- Replace route source-contract assertions that require provider stream draining and retry generation.
- Assert that the SSE branch uses the single-generation helper, records `live`, caches the valid payload, and never imports or invokes provider streaming.
- Assert that failed grounding/provider execution goes straight to a classified static fallback.
- Run the chat route security tests and confirm the new assertions fail before implementation.

## Task 2: Make retrieval precision-first

- Add real-data-shaped tests for exact room-code ranking, generic term suppression, unknown room-code containment, and a 12-record cap.
- Implement normalized code/phrase scoring, strong-match filtering, generic location stop words, deterministic ordering, and the lower cap.
- Run the context selection tests.

## Task 3: Remove campus data from synthetic health prompts

- Add a failing health route test that requires retrieval to be disabled.
- Add an internal `retrievalMode: "none"` execution option and pass it only from the synthetic health route.
- Verify the synthetic operations record contains no retrieved campus IDs.

## Task 4: Strengthen factual instructions and release binding

- Add prompt tests for exact-code abstention and multi-room completeness.
- Update the campus prompt and bump prompt/retrieval release bindings so caches and telemetry identify the behavior change.

## Task 5: Correct chat operations metrics

- Add mixed synthetic/user tests proving quality denominators use only user turns.
- Add `userTurns` and `syntheticTurns` to the summary, keep all outcomes visible, and update the dashboard labels and first-delivery wording.
- Run server-query and dashboard component tests.

## Task 6: Produce the reviewed CSV artifact

- Preserve the original 100 rows and append traffic type, retrieved count, issue category, severity, and concise review notes.
- Validate the output dimensions, headers, formula safety, and aggregate counts.

## Task 7: Verify the complete repair

- Run the full test suite, typecheck, lint, deterministic chat evaluation, and production build.
- Run the app locally, exercise an uncached SSE request and repeated cached request, and inspect the admin dashboard when credentials permit.
- Review the final diff for privacy, abort handling, telemetry truthfulness, and public/mobile contract compatibility.
