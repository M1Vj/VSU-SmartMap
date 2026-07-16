-- Fresh resets no longer grant administrator access from a fixed email address.
-- Existing hosted role grants are intentionally preserved: administrators must be
-- managed through app_user_roles or the explicit break-glass user ID setting.
DO $$
BEGIN
  RAISE NOTICE 'Legacy fixed-email bootstrap removed; existing role grants preserved.';
END
$$;
