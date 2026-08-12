# Chat Operations Root-Cause Repair Design

## Evidence

The exported 100-row operations sample contains 74 synthetic checks and 26 user-facing requests. Every uncached user request finished as a fallback or validation failure, no request finished as `live`, no cache hit occurred, and first delivery normally equaled total latency. A controlled production comparison confirmed that the default SSE path made a withheld structured-stream attempt and then a second generation, while the otherwise identical non-streaming request completed once as `live` and populated the cache.

The same export exposed two accuracy problems: retrieval commonly supplied the maximum 32 facility records even for exact room codes, and the validator checked referenced record identifiers but could not disprove unsupported prose such as an invented containing building. Synthetic health checks also retrieved 32 campus records and dominated the dashboard rates.

## Chosen design

Keep the existing client-compatible SSE envelope, but generate exactly once and release only the fully validated result. This is deliberately not marketed as token streaming: the first event is the complete validated answer, followed by the final structured payload. A valid answer is a `live` result and is eligible for the normal answer cache. Invalid grounding or provider failure goes directly to the static fallback; it never triggers a second model call.

Make facility retrieval precision-first. Exact room or facility codes outrank prose terms, generic location words do not create matches, weak description matches are discarded when a strong code/name match exists, and the context is capped at 12 facilities. Unknown codes may retrieve their plausible department/building context, but the prompt must explicitly report the requested code as absent instead of inventing a room or containment relationship.

Synthetic health generation receives no campus retrieval context because it tests provider/schema/grounding health, not factual recall. Dashboard quality and latency rates use user traffic only while outcome counts still expose synthetic volume.

## Observable contract

```gherkin
Feature: Reliable campus chat operations

  Rule: One user request performs at most one model generation
    Scenario: An uncached SSE request produces a valid answer
      Given the answer cache has no entry
      When the provider returns a grounding-valid structured answer
      Then the server records the outcome as live
      And the server stores the validated answer in the cache
      And the client receives one complete answer without a retry generation

    Scenario: The provider or grounding validation fails
      Given the answer cache has no entry
      When the single generation fails or references invalid records
      Then the server returns the static safe fallback
      And the server records the real error class
      And no second generation is attempted

  Rule: Retrieval minimizes unsupported claims
    Scenario Outline: An exact known room is requested
      When the user asks for <room>
      Then its canonical parent facility is the strongest context record
      And no more than 12 facilities are supplied

      Examples:
        | room             |
        | DMath-LecR3      |
        | DA Rm-203        |

    Scenario: An unknown room code is requested
      When the user asks for DPSS-9D
      Then unrelated facilities are not supplied
      And the assistant is instructed to say the exact code is unavailable

  Rule: Operational metrics distinguish real users from probes
    Scenario: A page contains synthetic and user turns
      Then user latency fallback cache and validation rates exclude synthetic turns
      And the dashboard shows user-turn and synthetic-check counts separately

    Scenario: The scheduled health probe runs
      Then no campus facility event knowledge or boarding-house records are retrieved
```

## Scope and compatibility

The public web repository owns the production chat implementation. The mobile repository is a Trusted Web Activity wrapper for the same origin and needs no duplicate change. The private-history repository remains untouched except for its existing unrelated work. No database migration or destructive data cleanup is required.
