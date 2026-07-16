-- Keep the room table scoped to the audited room dataset.
-- This removes leftover non-PDF room rows, such as old dormitory/admin test rooms.

BEGIN;

DELETE FROM rooms
WHERE NOT EXISTS (
  SELECT 1
  FROM facilities
  WHERE facilities.id = rooms.facility_id
    AND facilities.code = ANY (ARRAY[
      'DA', 'DABE', 'DAEEX', 'DALL', 'DAS', 'DBM', 'DBS', 'DBT', 'DCE', 'DCST',
      'DDC', 'DFS', 'DFST', 'DGE', 'DLABS', 'DMATH', 'DME', 'DMET', 'DOE', 'DOH',
      'DON', 'DOPAC', 'DPBG', 'DPHYS', 'DPM', 'DPSS', 'DSS', 'DSTAT', 'DTE',
      'DTHM', 'DVM', 'IHK', 'ISRDS', 'ITEEM'
    ]::text[])
);

COMMIT;
