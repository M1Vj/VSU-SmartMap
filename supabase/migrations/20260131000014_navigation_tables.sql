create table if not exists map_nodes (
  id uuid primary key,
  lat double precision not null,
  lng double precision not null,
  label text,
  type text not null,
  building_id uuid references facilities(id) on delete set null,
  floor_level integer,
  created_at timestamptz default now()
);

create table if not exists map_edges (
  id uuid primary key,
  source_id uuid not null references map_nodes(id) on delete cascade,
  target_id uuid not null references map_nodes(id) on delete cascade,
  weight double precision not null,
  bidirectional boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS
alter table map_nodes enable row level security;
alter table map_edges enable row level security;

-- Policies
create policy "Public nodes are viewable by everyone"
  on map_nodes for select
  using ( true );

create policy "Authenticated users can insert nodes"
  on map_nodes for insert
  with check ( auth.role() = 'authenticated' );

create policy "Authenticated users can update nodes"
  on map_nodes for update
  using ( auth.role() = 'authenticated' );

create policy "Authenticated users can delete nodes"
  on map_nodes for delete
  using ( auth.role() = 'authenticated' );

create policy "Public edges are viewable by everyone"
  on map_edges for select
  using ( true );

create policy "Authenticated users can insert edges"
  on map_edges for insert
  with check ( auth.role() = 'authenticated' );

create policy "Authenticated users can update edges"
  on map_edges for update
  using ( auth.role() = 'authenticated' );

create policy "Authenticated users can delete edges"
  on map_edges for delete
  using ( auth.role() = 'authenticated' );
