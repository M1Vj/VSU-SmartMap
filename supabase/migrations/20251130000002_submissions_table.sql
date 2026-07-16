CREATE TYPE submission_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  status submission_status NOT NULL DEFAULT 'PENDING',
  submitter_name TEXT,
  submitter_email TEXT,
  suggested_name TEXT NOT NULL,
  suggested_description TEXT,
  suggested_category TEXT,
  suggested_latitude DOUBLE PRECISION,
  suggested_longitude DOUBLE PRECISION,
  notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_facility_id ON submissions(facility_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can submit suggestions"
  ON submissions
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public read access for submissions"
  ON submissions
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage submissions"
  ON submissions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
