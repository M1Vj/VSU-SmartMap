-- Add advanced closure fields and path grouping to map_edges and map_nodes
alter table map_edges
add column if not exists closed_until_toggled boolean default false,
add column if not exists closure_daily_schedule jsonb default '{}'::jsonb;

-- Optional: path grouping field for future use
alter table map_edges add column if not exists group_id text;
alter table map_nodes add column if not exists group_id text;
