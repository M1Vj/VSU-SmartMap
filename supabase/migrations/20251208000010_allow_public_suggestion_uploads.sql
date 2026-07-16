-- Allow public (unauthenticated) users to upload images for suggestions
-- This matches the permissions on the suggestions table which allows public inserts

CREATE POLICY "Public upload suggestion images"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'smartmap-bucket' AND
  (storage.foldername(name))[1] = 'suggestion-images'
);
