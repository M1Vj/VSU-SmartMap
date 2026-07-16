# Data and assets

The repository includes institutional map facts, project-authored UI assets,
and clearly synthetic development fixtures. It does not claim ownership of
Visayas State University names, seals, marks, or third-party map imagery.

## Repository data

- Facility names, room labels, coordinates, navigation nodes, and event
  schedules are maintained as factual campus data. Contributors should cite a
  public source or describe the direct observation/organizer source in the PR.
- `supabase/seed.sql` provides public-safe local map fixtures. Boarding-house
  QA data and `@smartmap.example` accounts are synthetic and loopback-only.
- Generated caches, raw source documents, local exports, credentials, and
  personal filesystem paths must not be committed.

## Assets and external services

- Project-authored screenshots, icons, and interface graphics are distributed
  under the repository license unless a file states otherwise.
- University names and marks remain the property of their respective owners;
  inclusion is descriptive and does not imply endorsement.
- Basemap tiles and routing responses come from external providers and remain
  subject to their own terms and attribution requirements.
- User-submitted images must be owned or licensed by the submitter. Maintainers
  may remove disputed or sensitive material.

Before adding data or media, check for personal information, secret material,
license restrictions, and unnecessary provenance details. Security-sensitive
reports should follow `SECURITY.md`, not a public issue.
