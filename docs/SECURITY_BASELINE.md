# Production security baseline

Last reviewed: 2026-08-12

This document records the controls that protect the public VSU SmartMap source,
build, deployment, and production data. It is an operational baseline, not a
claim that the system can never be compromised.

## Repository and change control

- `main` accepts changes only through pull requests.
- History rewrites and branch deletion are blocked, with no bypass actors.
- Required checks run against the current `main`, review threads must be
  resolved, stale reviews are dismissed, and history remains linear.
- Workflow tokens default to read-only, cannot approve pull requests, and
  Actions must be GitHub-owned or explicitly allowlisted and SHA-pinned.
- CODEOWNERS identifies the maintainer for the repository and its high-risk
  automation, authentication, API, and database boundaries.
- Web commits require sign-off, merged branches are deleted automatically, and
  private vulnerability reporting is enabled.

## Automated security gates

- Quality gates cover types, lint, the full test suite, chat evaluations,
  production build, dependency audit, local database reset, integration tests,
  and adversarial RLS matrices.
- Security gates reject high-severity dependency advisories, sensitive tracked
  file paths, high-confidence credential formats, and unsafe GitHub Actions
  patterns.
- GitHub Dependabot, dependency security updates, secret scanning with push
  protection, and CodeQL default setup are enabled.
- Third-party Actions are pinned to immutable commit SHAs and checkout does not
  persist credentials.

## Application and deployment controls

- Vercel production deployments are restricted to protected branches; preview
  deployments accept branch builds. Environment administrators cannot bypass
  these branch policies.
- Production responses use HSTS at the platform and application-controlled CSP,
  clickjacking, MIME-sniffing, referrer, opener, and permissions policies.
- Framework disclosure through `X-Powered-By` is disabled.
- Request identifiers are generated at the server boundary rather than trusted
  from clients.
- Abuse-prone public writes use bounded payloads, durable quotas, Turnstile,
  normalized uploads, generic failures, and server-only privileged clients.

## Authentication and data controls

- Protected application routes verify Supabase users and database-backed roles;
  editable user metadata is not an authorization source.
- Public-schema tables use RLS and explicit grants. Privileged database
  functions use fixed search paths, narrow execution grants, internal identity
  or role checks, and adversarial tests.
- Private uploads, proof records, rate-limit buckets, answer caches, and alert
  claims are inaccessible to browser roles by design.
- Production database security advisors are reviewed alongside the automated
  local RLS matrices.

## Acceptance contract

```gherkin
Feature: Protected production delivery
  Rule: Unreviewed source cannot become the production main branch

    Scenario: A contributor proposes a change
      Given the change is on a non-default branch
      When a pull request targets main
      Then current required quality and security checks must pass
      And every review thread must be resolved
      And the result must preserve linear history

  Rule: A compromised workflow has least-privilege credentials

    Scenario: A workflow runs for untrusted source
      Given repository workflow permissions default to read-only
      When the workflow checks out the repository
      Then Git credentials are not persisted
      And third-party actions must match an immutable allowlisted SHA

  Rule: Browser responses receive defense-in-depth headers

    Scenario: A user requests a dynamic application route
      When the server returns the response
      Then scripts, frames, forms, objects, and network destinations are constrained
      And clickjacking and MIME-sniffing defenses are present
```

## Known residual risks and review triggers

- The CSP permits inline scripts and styles required by the current Next.js,
  theme-bootstrap, and styling stack. Moving to per-request nonces or hashes
  would strengthen XSS containment but changes caching and rendering behavior;
  treat that as a dedicated, browser-verified migration.
- Supabase leaked-password protection is a hosted Auth plan/account control. It
  should be enabled when available. Google OAuth remains the preferred student
  sign-in path, and existing password users remain subject to the configured
  Supabase Auth policy.
- A single maintainer cannot provide an independent human approval. Required
  automated gates, no bypass actors, CODEOWNERS, signed-off web commits, and
  resolved review threads provide compensating controls; add one required
  approval when a second trusted maintainer joins.
- Review this baseline after framework, GitHub, Vercel, Supabase, authentication,
  upload, LLM, or public-write changes, and at least quarterly.
