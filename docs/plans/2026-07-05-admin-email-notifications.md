# Admin Email Notifications Implementation Plan

1. Add notification event definitions, recipient filtering helpers, and email provider behavior tests.
2. Add Supabase migration for notification recipients and delivery logs with admin-only RLS.
3. Implement the server notification service and admin recipient actions.
4. Hook notifications into owner application submission, owner approval, listing review submission, live listing re-review, student reports, and suggestions.
5. Add `/admin/notifications` with recipient management and recent delivery logs.
6. Add admin navigation, environment documentation, and verify with tests, typecheck, browser flow, Supabase push, PR, and merge.
