-- Surface the latest admin decision reason to the owner. moderation_events stays
-- the full audit trail (admin-only); this column is the owner-visible "why" for a
-- rejected / suspended / unpublished listing, cleared when the listing is published.
ALTER TABLE boarding_house_listings
  ADD COLUMN IF NOT EXISTS moderation_note TEXT;

CREATE OR REPLACE FUNCTION public.moderate_boarding_house_listing(
  p_listing_id UUID,
  p_action TEXT,
  p_actor_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing RECORD;
BEGIN
  SELECT * INTO listing FROM public.boarding_house_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;

  IF p_action = 'publish' THEN
    IF listing.status NOT IN ('pending_review','unpublished','suspended','draft') THEN
      RAISE EXCEPTION 'Cannot publish a listing in status %', listing.status;
    END IF;
    UPDATE public.boarding_house_listings
      SET status = 'published', verification_status = 'verified',
          published_at = now(), suspended_at = NULL, rejected_at = NULL,
          moderation_note = NULL
      WHERE id = p_listing_id;
  ELSIF p_action = 'reject' THEN
    UPDATE public.boarding_house_listings
      SET status = 'rejected', rejected_at = now(), moderation_note = p_note
      WHERE id = p_listing_id;
  ELSIF p_action = 'unpublish' THEN
    UPDATE public.boarding_house_listings
      SET status = 'unpublished', moderation_note = p_note
      WHERE id = p_listing_id;
  ELSIF p_action = 'suspend' THEN
    UPDATE public.boarding_house_listings
      SET status = 'suspended', suspended_at = now(), moderation_note = p_note
      WHERE id = p_listing_id;
  ELSE
    RAISE EXCEPTION 'Unknown moderation action %', p_action;
  END IF;

  INSERT INTO public.boarding_house_moderation_events (listing_id, actor_id, event_type, note)
  VALUES (p_listing_id, p_actor_id, 'listing_' || p_action, p_note);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.moderate_boarding_house_listing(UUID, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
