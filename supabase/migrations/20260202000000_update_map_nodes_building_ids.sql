alter table map_nodes 
drop column if exists building_id,
add column if not exists building_ids uuid[] default array[]::uuid[];
