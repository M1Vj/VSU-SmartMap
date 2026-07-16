-- Create Enums
CREATE TYPE bug_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE bug_status AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- Create bug_reports table
CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity bug_severity NOT NULL DEFAULT 'LOW',
  status bug_status NOT NULL DEFAULT 'OPEN',
  screenshot_url TEXT,
  device_info JSONB,
  user_details JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_severity ON bug_reports(severity);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at DESC);

-- Enable RLS
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Public can submit (insert)
CREATE POLICY "Public can submit bug reports"
  ON bug_reports
  FOR INSERT
  TO public
  WITH CHECK (status = 'OPEN');

-- Policy: Authenticated users (Admins) can view all
CREATE POLICY "Authenticated users can view bug reports"
  ON bug_reports
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users (Admins) can update (e.g. status)
CREATE POLICY "Authenticated users can update bug reports"
  ON bug_reports
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger to automatically update the updated_at column on row modification
CREATE TRIGGER bug_reports_updated_at
  BEFORE UPDATE ON bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
