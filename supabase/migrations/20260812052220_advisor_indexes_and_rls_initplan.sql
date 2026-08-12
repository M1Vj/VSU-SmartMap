-- Cover every currently unindexed public foreign key reported by the Supabase
-- performance advisor.  These single-column indexes keep parent updates and
-- deletes from requiring a full scan of the referencing table.
CREATE INDEX IF NOT EXISTS app_bug_incidents_sample_event_id_idx
  ON public.app_bug_incidents (sample_event_id);

CREATE INDEX IF NOT EXISTS app_user_roles_granted_by_idx
  ON public.app_user_roles (granted_by);

CREATE INDEX IF NOT EXISTS boarding_house_moderation_events_actor_id_idx
  ON public.boarding_house_moderation_events (actor_id);
CREATE INDEX IF NOT EXISTS boarding_house_moderation_events_listing_id_idx
  ON public.boarding_house_moderation_events (listing_id);

CREATE INDEX IF NOT EXISTS boarding_house_reports_listing_id_idx
  ON public.boarding_house_reports (listing_id);
CREATE INDEX IF NOT EXISTS boarding_house_reports_reviewer_id_idx
  ON public.boarding_house_reports (reviewer_id);

CREATE INDEX IF NOT EXISTS boarding_house_reviews_author_id_idx
  ON public.boarding_house_reviews (author_id);
CREATE INDEX IF NOT EXISTS boarding_house_reviews_reviewer_id_idx
  ON public.boarding_house_reviews (reviewer_id);

CREATE INDEX IF NOT EXISTS boarding_house_revisions_listing_id_idx
  ON public.boarding_house_revisions (listing_id);
CREATE INDEX IF NOT EXISTS boarding_house_revisions_owner_id_idx
  ON public.boarding_house_revisions (owner_id);
CREATE INDEX IF NOT EXISTS boarding_house_revisions_reviewer_id_idx
  ON public.boarding_house_revisions (reviewer_id);
CREATE INDEX IF NOT EXISTS boarding_house_revisions_submitted_by_idx
  ON public.boarding_house_revisions (submitted_by);

CREATE INDEX IF NOT EXISTS map_edges_source_id_idx
  ON public.map_edges (source_id);
CREATE INDEX IF NOT EXISTS map_edges_target_id_idx
  ON public.map_edges (target_id);

CREATE INDEX IF NOT EXISTS notification_recipients_created_by_idx
  ON public.notification_recipients (created_by);
CREATE INDEX IF NOT EXISTS notification_recipients_updated_by_idx
  ON public.notification_recipients (updated_by);

CREATE INDEX IF NOT EXISTS owner_applications_reviewer_id_idx
  ON public.owner_applications (reviewer_id);
CREATE INDEX IF NOT EXISTS owner_applications_user_id_idx
  ON public.owner_applications (user_id);

CREATE INDEX IF NOT EXISTS owner_verification_documents_application_id_idx
  ON public.owner_verification_documents (application_id);
CREATE INDEX IF NOT EXISTS owner_verification_documents_user_id_idx
  ON public.owner_verification_documents (user_id);

-- Cache the authenticated identity once per statement rather than re-reading
-- the JWT setting for every row considered by this owner-scoped policy.
DROP POLICY IF EXISTS "Users view own suggestions" ON public.event_suggestions;
CREATE POLICY "Users view own suggestions"
  ON public.event_suggestions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = submitted_by);
