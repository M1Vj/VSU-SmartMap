-- Remove internal import notes from public facility descriptions.

BEGIN;

UPDATE facilities
SET description = btrim(regexp_replace(
  description,
  '\s*' || 'Room' || ' data' || ' source: .*?Search aliases:',
  ' Search aliases:'
))
WHERE description ILIKE '%' || 'Room' || ' data' || ' source:%';

COMMIT;
