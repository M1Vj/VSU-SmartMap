-- Cleanup migration to remove parsing artifacts and fix UI redundancy

-- 1. Delete rooms that are just numbers (parsing artifacts from Capacity column)
DELETE FROM rooms WHERE room_code ~ '^[0-9]+$';

-- 2. Delete rooms that are header artifacts
DELETE FROM rooms 
WHERE room_code ILIKE 'Capacity' 
   OR room_code ILIKE 'Room' 
   OR room_code ILIKE 'Remarks' 
   OR room_code ILIKE 'Total' 
   OR room_code ILIKE 'Grand Total'
   OR room_code ILIKE 'Actual Capacity'
   OR room_code ILIKE 'Lec/Lab'
   OR room_code ILIKE 'OK'
   OR room_code ILIKE 'DELETED';

-- 3. Remove redundant names (where Name is exactly the same as Code)
-- User requested to "make it blank"
UPDATE rooms 
SET name = '' 
WHERE name = room_code;
