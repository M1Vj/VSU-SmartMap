-- NOTE: This project already has a `suggestion_status` enum (used by `suggestions`),
-- so we use `event_suggestion_status` for the events system to avoid conflicts.

-- Create event_category ENUM (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'event_category'
  ) THEN
    CREATE TYPE event_category AS ENUM (
      'academic',
      'sports',
      'cultural',
      'religious',
      'other'
    );
  END IF;
END $$;

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location_text TEXT,
  location_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  category event_category NOT NULL DEFAULT 'other',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create event_suggestion_status ENUM (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'event_suggestion_status'
  ) THEN
    CREATE TYPE event_suggestion_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

-- Create event_suggestions table
CREATE TABLE IF NOT EXISTS event_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location_text TEXT,
  category event_category NOT NULL DEFAULT 'other',
  proof_file_url TEXT NOT NULL,
  status event_suggestion_status NOT NULL DEFAULT 'pending',
  submitted_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for events
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_location_id ON events(location_id);

-- Create indexes for event_suggestions
CREATE INDEX IF NOT EXISTS idx_event_suggestions_status ON event_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_event_suggestions_submitted_by ON event_suggestions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_event_suggestions_created_at ON event_suggestions(created_at);

-- Enable RLS for events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events
DROP POLICY IF EXISTS "Public read events" ON events;
CREATE POLICY "Public read events" 
  ON events 
  FOR SELECT 
  TO public
  USING (true);

DROP POLICY IF EXISTS "Admins manage events" ON events;
CREATE POLICY "Admins manage events" 
  ON events 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.uid() = id 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Enable RLS for event_suggestions
ALTER TABLE event_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_suggestions
DROP POLICY IF EXISTS "Users create suggestions" ON event_suggestions;
CREATE POLICY "Users create suggestions" 
  ON event_suggestions 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = submitted_by);

DROP POLICY IF EXISTS "Users view own suggestions" ON event_suggestions;
CREATE POLICY "Users view own suggestions" 
  ON event_suggestions 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = submitted_by);

DROP POLICY IF EXISTS "Admins manage suggestions" ON event_suggestions;
CREATE POLICY "Admins manage suggestions" 
  ON event_suggestions 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.uid() = id 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Create trigger for events updated_at
DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage buckets for event-related files
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('event-proofs', 'event-proofs', true),
  ('event-images', 'event-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies for event-proofs bucket
DROP POLICY IF EXISTS "Public read event-proofs" ON storage.objects;
CREATE POLICY "Public read event-proofs"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'event-proofs');

DROP POLICY IF EXISTS "Authenticated upload event-proofs" ON storage.objects;
CREATE POLICY "Authenticated upload event-proofs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'event-proofs');

DROP POLICY IF EXISTS "Authenticated update event-proofs" ON storage.objects;
CREATE POLICY "Authenticated update event-proofs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'event-proofs')
  WITH CHECK (bucket_id = 'event-proofs');

DROP POLICY IF EXISTS "Authenticated delete event-proofs" ON storage.objects;
CREATE POLICY "Authenticated delete event-proofs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'event-proofs');

-- Storage policies for event-images bucket
DROP POLICY IF EXISTS "Public read event-images" ON storage.objects;
CREATE POLICY "Public read event-images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'event-images');

DROP POLICY IF EXISTS "Authenticated upload event-images" ON storage.objects;
CREATE POLICY "Authenticated upload event-images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'event-images');

DROP POLICY IF EXISTS "Authenticated update event-images" ON storage.objects;
CREATE POLICY "Authenticated update event-images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'event-images')
  WITH CHECK (bucket_id = 'event-images');

DROP POLICY IF EXISTS "Authenticated delete event-images" ON storage.objects;
CREATE POLICY "Authenticated delete event-images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'event-images');
