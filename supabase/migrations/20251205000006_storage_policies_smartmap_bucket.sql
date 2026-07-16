-- Ensure bucket exists and is public
insert into storage.buckets (id, name, public)
values ('smartmap-bucket', 'smartmap-bucket', true)
on conflict (id) do update set public = true;

-- Public read access for smartmap-bucket
create policy "Public read smartmap-bucket"
  on storage.objects
  for select
  to public
  using (bucket_id = 'smartmap-bucket');

-- Clean up legacy policies if present
drop policy if exists "Authenticated manage Smartmap_Bucket" on storage.objects;
drop policy if exists "Authenticated upload Smartmap_Bucket" on storage.objects;
drop policy if exists "Authenticated update Smartmap_Bucket" on storage.objects;
drop policy if exists "Authenticated delete Smartmap_Bucket" on storage.objects;

-- Authenticated users can upload to the bucket
create policy "Authenticated upload smartmap-bucket"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'smartmap-bucket');

-- Authenticated users can update any object in the bucket
create policy "Authenticated update smartmap-bucket"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'smartmap-bucket')
  with check (bucket_id = 'smartmap-bucket');

-- Authenticated users can delete any object in the bucket
create policy "Authenticated delete smartmap-bucket"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'smartmap-bucket');
