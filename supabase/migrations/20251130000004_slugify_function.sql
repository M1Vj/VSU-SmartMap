CREATE OR REPLACE FUNCTION slugify(text) RETURNS text AS $$
  SELECT lower(regexp_replace(regexp_replace($1, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
$$ LANGUAGE sql IMMUTABLE;
