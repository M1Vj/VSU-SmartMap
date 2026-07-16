CREATE TYPE suggestion_type AS ENUM ('ADD_FACILITY', 'EDIT_FACILITY', 'ADD_ROOM', 'EDIT_ROOM');

CREATE TYPE suggestion_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE IF NOT EXISTS suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type suggestion_type NOT NULL,
  status suggestion_status NOT NULL DEFAULT 'PENDING',
  target_id UUID,
  payload JSONB NOT NULL,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_type ON suggestions(type);
CREATE INDEX IF NOT EXISTS idx_suggestions_target_id ON suggestions(target_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON suggestions(created_at DESC);

ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can submit suggestions"
  ON suggestions
  FOR INSERT
  TO public
  WITH CHECK (status = 'PENDING' AND admin_note IS NULL);

CREATE POLICY "Authenticated users can view suggestions"
  ON suggestions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update suggestions"
  ON suggestions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER suggestions_updated_at
  BEFORE UPDATE ON suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
