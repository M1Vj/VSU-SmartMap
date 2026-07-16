-- Current uploads use narrow server-managed paths in smartmap-bucket. Keep the
-- legacy public event-images bucket readable for old objects, but remove generic
-- authenticated mutation rights.
DROP POLICY IF EXISTS "Authenticated upload event-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update event-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete event-images" ON storage.objects;
