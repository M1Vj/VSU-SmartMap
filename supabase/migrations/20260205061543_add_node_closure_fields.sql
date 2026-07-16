-- Add closure fields to map_nodes
alter table public.map_nodes
add column if not exists is_closed boolean default false,
add column if not exists closed_until_toggled boolean default false,
add column if not exists closed_from timestamptz,
add column if not exists closed_until timestamptz,
add column if not exists closure_reason text,
add column if not exists closure_recurring_start text,
add column if not exists closure_recurring_end text,
add column if not exists closure_recurring_days integer[],
add column if not exists closure_daily_schedule jsonb default '{}'::jsonb;
