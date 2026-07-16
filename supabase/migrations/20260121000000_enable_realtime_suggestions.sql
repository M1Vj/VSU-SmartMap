/**
 * Enable real-time updates for the suggestions table.
 * This ensures that the admin dashboard receives live updates when new suggestions are submitted.
 */
alter publication supabase_realtime add table suggestions;
