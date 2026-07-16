-- Add is_closed column to map_edges
alter table map_edges
add column if not exists is_closed boolean default false;
