-- Structured application telemetry and actionable incident triage.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS app_bug_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 1200),
  summary TEXT,
  severity bug_severity NOT NULL DEFAULT 'LOW',
  status bug_status NOT NULL DEFAULT 'OPEN',
  source TEXT NOT NULL CHECK (source IN ('client', 'server')),
  route TEXT,
  sample_event_id UUID,
  event_count INTEGER NOT NULL DEFAULT 1 CHECK (event_count >= 1),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_log_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES app_bug_incidents(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('client', 'server')),
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
  event_name TEXT NOT NULL CHECK (char_length(event_name) BETWEEN 1 AND 240),
  message TEXT,
  session_id TEXT,
  request_id TEXT,
  route TEXT,
  method TEXT,
  status_code INTEGER,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  user_agent TEXT,
  release TEXT,
  environment TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  breadcrumbs JSONB NOT NULL DEFAULT '[]'::jsonb,
  fingerprint TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_bug_incidents
  ADD CONSTRAINT app_bug_incidents_sample_event_fk
  FOREIGN KEY (sample_event_id)
  REFERENCES app_log_events(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS idx_app_bug_incidents_status ON app_bug_incidents(status);
CREATE INDEX IF NOT EXISTS idx_app_bug_incidents_severity ON app_bug_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_app_bug_incidents_source ON app_bug_incidents(source);
CREATE INDEX IF NOT EXISTS idx_app_bug_incidents_route ON app_bug_incidents(route);
CREATE INDEX IF NOT EXISTS idx_app_bug_incidents_last_seen ON app_bug_incidents(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_bug_incidents_fingerprint ON app_bug_incidents(fingerprint);

CREATE INDEX IF NOT EXISTS idx_app_log_events_incident ON app_log_events(incident_id);
CREATE INDEX IF NOT EXISTS idx_app_log_events_level ON app_log_events(level);
CREATE INDEX IF NOT EXISTS idx_app_log_events_source ON app_log_events(source);
CREATE INDEX IF NOT EXISTS idx_app_log_events_name ON app_log_events(event_name);
CREATE INDEX IF NOT EXISTS idx_app_log_events_route ON app_log_events(route);
CREATE INDEX IF NOT EXISTS idx_app_log_events_session ON app_log_events(session_id);
CREATE INDEX IF NOT EXISTS idx_app_log_events_request ON app_log_events(request_id);
CREATE INDEX IF NOT EXISTS idx_app_log_events_occurred ON app_log_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_log_events_fingerprint ON app_log_events(fingerprint);

DROP TRIGGER IF EXISTS app_bug_incidents_updated_at ON app_bug_incidents;
CREATE TRIGGER app_bug_incidents_updated_at
  BEFORE UPDATE ON app_bug_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE app_bug_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_log_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view bug incidents" ON app_bug_incidents;
CREATE POLICY "Admins can view bug incidents"
  ON app_bug_incidents
  FOR SELECT
  TO authenticated
  USING (public.has_app_role('admin'));

DROP POLICY IF EXISTS "Admins can update bug incidents" ON app_bug_incidents;
CREATE POLICY "Admins can update bug incidents"
  ON app_bug_incidents
  FOR UPDATE
  TO authenticated
  USING (public.has_app_role('admin'))
  WITH CHECK (public.has_app_role('admin'));

DROP POLICY IF EXISTS "Admins can view app log events" ON app_log_events;
CREATE POLICY "Admins can view app log events"
  ON app_log_events
  FOR SELECT
  TO authenticated
  USING (public.has_app_role('admin'));

DROP POLICY IF EXISTS "Admins can update app log events" ON app_log_events;
CREATE POLICY "Admins can update app log events"
  ON app_log_events
  FOR UPDATE
  TO authenticated
  USING (public.has_app_role('admin'))
  WITH CHECK (public.has_app_role('admin'));
