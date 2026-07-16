-- Add policy to allow authenticated users (ADMINS) to insert suggestions with any status (e.g., APPROVED for history)
CREATE POLICY "Authenticated users can insert suggestions"
  ON suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
