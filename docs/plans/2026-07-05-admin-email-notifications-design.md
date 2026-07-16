# Admin Email Notifications Design

## Scope

Add transactional notifications for boarding-house workflows and admin inbox routing:

- Email boarding-house owners after an admin approves their owner application.
- Email configured admin recipients when students submit suggestions or boarding-house reports.
- Email configured admin recipients when owners submit an application, submit a listing for review, or edit a live listing in a way that requires review.
- Add an admin page that lists and manages the email recipients and event types.

## Decisions

- Store admin notification recipients in Supabase, not environment variables, so admins can update the list without redeploying.
- Send owner approval messages directly to the approved application email.
- Use a provider adapter that sends through Gmail API when Gmail OAuth settings are configured; Resend remains available as a fallback.
- When no provider is configured, record each notification attempt as `skipped` instead of failing the user workflow.
- Keep notification delivery best-effort. Moderation and submission actions should not fail only because email delivery failed.

## Events

- `owner_application_submitted`
- `owner_application_approved`
- `boarding_house_listing_submitted`
- `boarding_house_listing_updated`
- `boarding_house_report_submitted`
- `suggestion_submitted`

## Data Model

- `notification_recipients` stores enabled admin recipient emails, labels, and subscribed events.
- `notification_delivery_logs` stores sent, skipped, and failed attempts for admin visibility and debugging.

## Non-Goals

- No external email-provider account is created automatically.
- No user account creation is required for this change.
