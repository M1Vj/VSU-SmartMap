-- Add detailed closure fields to map_edges
alter table map_edges
add column if not exists closed_from timestamptz,
add column if not exists closed_until timestamptz,
add column if not exists closure_reason text,
add column if not exists closure_recurring_start text,
add column if not exists closure_recurring_end text,
add column if not exists closure_recurring_days integer[];
