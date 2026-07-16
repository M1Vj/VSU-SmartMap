CREATE TYPE notification_delivery_status AS ENUM (
  'sent',
  'skipped',
  'failed'
);

CREATE TABLE IF NOT EXISTS notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  event_types TEXT[] NOT NULL DEFAULT ARRAY[
    'owner_application_submitted',
    'owner_application_approved',
    'boarding_house_listing_submitted',
    'boarding_house_listing_updated',
    'boarding_house_report_submitted',
    'suggestion_submitted'
  ]::TEXT[],
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_recipients_email_format CHECK (
    email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  CONSTRAINT notification_recipients_event_types_nonempty CHECK (
    array_length(event_types, 1) > 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_recipients_email_lower_idx
  ON notification_recipients (lower(email));

CREATE TRIGGER update_notification_recipients_updated_at
  BEFORE UPDATE ON notification_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status notification_delivery_status NOT NULL,
  provider TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_delivery_logs_created_at_idx
  ON notification_delivery_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS notification_delivery_logs_event_type_idx
  ON notification_delivery_logs (event_type);

ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notification recipients"
  ON notification_recipients
  FOR ALL
  USING (public.has_app_role('admin'))
  WITH CHECK (public.has_app_role('admin'));

CREATE POLICY "Admins read notification delivery logs"
  ON notification_delivery_logs
  FOR SELECT
  USING (public.has_app_role('admin'));

CREATE POLICY "Admins create notification delivery logs"
  ON notification_delivery_logs
  FOR INSERT
  WITH CHECK (public.has_app_role('admin'));
