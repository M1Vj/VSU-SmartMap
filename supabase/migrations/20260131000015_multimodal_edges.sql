alter table map_edges 
add column if not exists type text default 'walkway',
add column if not exists access text[] default array['walking'];

create index if not exists idx_map_edges_type on map_edges(type);
