# Storage contract

Supabase migrations are the source of truth for storage. Do not create broad
Dashboard policies that bypass the restrictions below.

| Bucket | Read access | Write access | Purpose |
| --- | --- | --- | --- |
| `smartmap-bucket` | Public | Narrow server/admin flows | Facility images and staged suggestion images |
| `boarding-house-photos` | Signed/private | Listing owner or administrator | Listing and room photos |
| `boarding-house-verification` | Private | Applicant upload flow; owner/admin read rules | Temporary identity and authority evidence |
| `event-proofs` | Private | Narrow server upload flow | Temporary evidence attached to event suggestions |
| `event-images` | Public legacy read | None for ordinary authenticated users | Backward compatibility for older published event images |

Uploaded public-write files are constrained by server-issued upload intents,
path patterns, MIME type, size, and short retention windows. Verification and
event-proof objects must never be exposed through public URLs. Legacy
`event-images` objects remain readable until a production inventory and
migration can confirm they are no longer needed.

Current limits and policy details live in `supabase/migrations/`. Changes must
be made through a reviewed forward migration and verified with `npm run qa:rls`.
