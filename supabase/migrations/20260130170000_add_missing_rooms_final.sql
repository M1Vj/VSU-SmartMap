-- Migration to add missing facilities and rooms from PDF data


INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES (
  'Dept. of Agronomy', 
  'da', 
  'Agronomy Department', 
  'academic', 
  true, 
  10.7461, 
  124.7933, 
  'DA'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES (
  'Dept. of Horticulture', 
  'doh', 
  'Horticulture Department', 
  'academic', 
  true, 
  10.7461, 
  124.7933, 
  'DOH'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES (
  'Dept. of Plant Breeding & Genetics', 
  'dpbg', 
  'Plant Breeding and Genetics', 
  'academic', 
  true, 
  10.7461, 
  124.7933, 
  'DPBG'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES (
  'Dept. of Pest Management', 
  'dpm', 
  'Pest Management Department', 
  'academic', 
  true, 
  10.7461, 
  124.7933, 
  'DPM'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES (
  'Dept. of Soil Science', 
  'dss', 
  'Soil Science Department', 
  'academic', 
  true, 
  10.7461, 
  124.7933, 
  'DSS'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES (
  'Dept. of Animal Science', 
  'das', 
  'Animal Science Department', 
  'academic', 
  true, 
  10.7475, 
  124.7932, 
  'DAS'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES (
  'Dept. of Dev. Communication', 
  'ddc', 
  'Development Communication Department', 
  'academic', 
  true, 
  10.7447, 
  124.7949, 
  'DDC'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES (
  'Dept. of Food Sci. & Tech.', 
  'dfst', 
  'Food Science and Technology Department', 
  'academic', 
  true, 
  10.7476, 
  124.7928, 
  'DFST'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES (
  'Dept. of Tourism Mgmt', 
  'dtm', 
  'Tourism Management (2nd Flr)', 
  'academic', 
  true, 
  10.7451, 
  124.795, 
  'DTM'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES (
  'Dept. of Hospitality Mgmt', 
  'dhm', 
  'Hospitality Management (1st Flr)', 
  'academic', 
  true, 
  10.7451, 
  124.795, 
  'DHM'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Insert Rooms

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DA';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DA - CONFERENCE ROOM', 'DA - CONFERENCE ROOM', 1, 'Capacity: 10')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DA';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DA PSB Rm-1', 'DA PSB Rm-1', 1, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DA';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DA PSB Rm-2', 'DA PSB Rm-2', 1, 'Capacity: 50')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DA';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DA Rm-201', 'DA Rm-201', 2, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DA';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DA Rm-202', 'DA Rm-202', 2, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DA';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DA Rm-203 / SMART ROOM', 'DA Rm-203 / SMART ROOM', 2, 'Capacity: 50')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DA';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'PSB Rm-10', 'PSB Rm-10', 1, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DA';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'PSB Rm-9', 'PSB Rm-9', 1, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DAS CONFERENCE ROOM', 'DAS CONFERENCE ROOM', 1, 'Capacity: 12')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DAS MEAT LABORATORY', 'DAS MEAT LABORATORY', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DAS-1', 'DAS-1', 1, 'Capacity: 45')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DAS-2', 'DAS-2', 1, 'Capacity: 45')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DAS-3', 'DAS-3', 1, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DAS-5', 'DAS-5', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DAS-7', 'DAS-7', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DDC';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ADE-123A', 'ADE-123A', 1, 'Capacity: 20')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DDC';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ADE-218', 'ADE-218', 2, 'Capacity: 45')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DDC';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DDC-NEW ROOM', 'DDC-NEW ROOM', 1, 'Capacity: 45')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DFST';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DFST FM Rm', 'DFST FM Rm', 1, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DFST';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DFST LECTURE ROOM', 'DFST LECTURE ROOM', 1, 'Capacity: 50')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DFST';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DFST LIBRARY', 'DFST LIBRARY', 1, 'Capacity: 10')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DFST';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DFST PILOT ROOM', 'DFST PILOT ROOM', 1, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DFST';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DFST SENSORY ROOM', 'DFST SENSORY ROOM', 1, 'Capacity: 25')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DOH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DOH-101', 'DOH-101', 1, 'Capacity: 80')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DOH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DOH-202', 'DOH-202', 2, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DOH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DOH-CropPhy (Hort)', 'DOH-CropPhy (Hort)', 1, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DOH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DOH-Ornam', 'DOH-Ornam', 1, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DOH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DOH-Post har (Hort)', 'DOH-Post har (Hort)', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DOH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'PSB DOH-05', 'PSB DOH-05', 1, 'Capacity: 50')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DPBG';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPBG LR-1', 'DPBG LR-1', 1, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DPBG';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPBG-204', 'DPBG-204', 2, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DPBG';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPBG-LH', 'DPBG-LH', 1, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DPBG';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPBG-PSB', 'DPBG-PSB', 1, 'Capacity: 11')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DPBG';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPBG-PSB', 'DPBG-PSB', 1, 'Capacity: 12')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DPM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPM PSB Rm-6', 'DPM PSB Rm-6', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DPM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPM-101', 'DPM-101', 1, 'Capacity: 100')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DPM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPM-102', 'DPM-102', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DPM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPM-103', 'DPM-103', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DPM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPM-105', 'DPM-105', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DPM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPM-106', 'DPM-106', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DPM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPM-107', 'DPM-107', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DSS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DSS-116', 'DSS-116', 1, 'Capacity: 25')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DSS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DSS-119', 'DSS-119', 1, 'Capacity: 100')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DSS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DSS-205', 'DSS-205', 2, 'Capacity: 25')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DSS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DSS-206', 'DSS-206', 2, 'Capacity: 25')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DSS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'PSB-07', 'PSB-07', 1, 'Capacity: 50')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DSS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'PSB-08', 'PSB-08', 1, 'Capacity: 50')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DALL-2A1', 'DALL-2A1', 1, 'Capacity: 45')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DALL-2A2', 'DALL-2A2', 1, 'Capacity: 45')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DALL-3B', 'DALL-3B', 1, 'Capacity: 45')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DALL-4B', 'DALL-4B', 1, 'Capacity: 45')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DALL-6C', 'DALL-6C', 1, 'Capacity: 45')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DALL-7C', 'DALL-7C', 1, 'Capacity: 45')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DALL-ERR1', 'DALL-ERR1', 1, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MATHNS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DBS-101', 'DBS-101', 1, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MATHNS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DBS-102', 'DBS-102', 1, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MATHNS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DBS-103', 'DBS-103', 1, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MATHNS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DBS-104', 'DBS-104', 1, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MATHNS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DBS-105', 'DBS-105', 1, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MATHNS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DBS-106', 'DBS-106', 1, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MATHNS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DBS-AnaLab', 'DBS-AnaLab', 1, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'BIOTECH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DBT-Lab1', 'DBT-Lab1', 1, 'Capacity: 15')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'BIOTECH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DBT-Lab2', 'DBT-Lab2', 1, 'Capacity: 25')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'BIOTECH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DBT-LecR1', 'DBT-LecR1', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'BIOTECH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DBT-LecR2', 'DBT-LecR2', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DLABS- AUDUTORIUM', 'DLABS- AUDUTORIUM', 1, 'Capacity: 80')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MATH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DMATH CONF ROOM', 'DMATH CONF ROOM', 1, 'Capacity: 20')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MATH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DMATH Lab', 'DMATH Lab', 1, 'Capacity: 20')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MATH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DMath-LecR1', 'DMath-LecR1', 1, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MATH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DMath-LecR2', 'DMath-LecR2', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MATH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DMath-LecR3', 'DMath-LecR3', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MATH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DMath-LecR4', 'DMath-LecR4', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MATH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DMath-LecR5', 'DMath-LecR5', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CHEM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'AC-105', 'AC-105', 1, 'Capacity: 15')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CHEM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'AC-106', 'AC-106', 1, 'Capacity: 20')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CHEM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'AC-108', 'AC-108', 1, 'Capacity: 20')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CHEM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'AC-206', 'AC-206', 2, 'Capacity: 20')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CHEM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'AC-208', 'AC-208', 2, 'Capacity: 20')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CHEM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'AC-209A', 'AC-209A', 2, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CHEM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'AC-209B', 'AC-209B', 2, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CHEM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'AC-210', 'AC-210', 2, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'PHYS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPhys Comp. Lab', 'DPhys Comp. Lab', 1, 'Capacity: 15')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'PHYS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPhys Lab', 'DPhys Lab', 1, 'Capacity: 1')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'PHYS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPhys Lab', 'DPhys Lab', 1, 'Capacity: 2')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'PHYS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPhys Lab', 'DPhys Lab', 1, 'Capacity: 3')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'PHYS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPhys Lec', 'DPhys Lec', 1, 'Capacity: 1')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'PHYS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPhys Lec', 'DPhys Lec', 1, 'Capacity: 2')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPSS-10D', 'DPSS-10D', 1, 'Capacity: 45')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPSS-11D', 'DPSS-11D', 1, 'Capacity: 45')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPSS-12D', 'DPSS-12D', 1, 'Capacity: 45')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPSS-13D', 'DPSS-13D', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPSS-5B1', 'DPSS-5B1', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPSS-8C', 'DPSS-8C', 1, 'Capacity: 45')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DPSS-9C', 'DPSS-9C', 1, 'Capacity: 45')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'STAT';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DStat Lab', 'DStat Lab', 1, 'Capacity: 1')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'STAT';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DStat Lab', 'DStat Lab', 1, 'Capacity: 2')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'STAT';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DStat Lab', 'DStat Lab', 1, 'Capacity: 3')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'STAT';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DStat Lec', 'DStat Lec', 1, 'Capacity: 1')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'STAT';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DStat Lec', 'DStat Lec', 1, 'Capacity: 2')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'STAT';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DStat LH', 'DStat LH', 1, 'Capacity: 75')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DABE';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'CPB', 'CPB', 1, 'Capacity: 1')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DABE';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'CPB', 'CPB', 1, 'Capacity: 2')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DABE';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-101', 'EB-101', 1, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DABE';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-105', 'EB-105', 1, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DABE';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-106', 'EB-106', 1, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DABE';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-202', 'EB-202', 2, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DABE';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'SLH', 'SLH', 1, 'Capacity: 80')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CET';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DCE- MTLR', 'DCE- MTLR', 1, 'Capacity: 20')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CET';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-101Anx', 'EB-101Anx', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CET';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-102 Anx', 'EB-102 Anx', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CET';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-103 Anx', 'EB-103 Anx', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CET';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-103 comp. Lab', 'EB-103 comp. Lab', 1, 'Capacity: 25')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CET';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-107 DRAFTING Rm', 'EB-107 DRAFTING Rm', 1, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CET';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'Soils Mech Lab.', 'Soils Mech Lab.', 1, 'Capacity: 20')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CSAT';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ICT-101', 'ICT-101', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CSAT';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ICT-102 / OFFICE ROOM', 'ICT-102 / OFFICE ROOM', 1, 'Capacity: 24')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CSAT';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ICT-103', 'ICT-103', 1, 'Capacity: 20')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CSAT';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ICT-201', 'ICT-201', 2, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CSAT';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ICT-202', 'ICT-202', 2, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CSAT';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ICT-203', 'ICT-203', 2, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'GE';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-102', 'EB-102', 1, 'Capacity: 25')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'GE';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-201 Anx', 'EB-201 Anx', 2, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'GE';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-202 Anx', 'EB-202 Anx', 2, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'GE';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-203 Anx', 'EB-203 Anx', 2, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'GE';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-204', 'EB-204', 2, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MECH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DME-LR', 'DME-LR', 1, 'Capacity: 1')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MECH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DME-LR', 'DME-LR', 1, 'Capacity: 2')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'MECH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DME-LR', 'DME-LR', 1, 'Capacity: 4')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CET';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-104 Anx', 'EB-104 Anx', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CET';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-105 Anx', 'EB-105 Anx', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CET';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-201 Comp. Lab', 'EB-201 Comp. Lab', 2, 'Capacity: 25')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CFNR';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DFS COMPUTER ROOM', 'DFS COMPUTER ROOM', 1, 'Capacity: 50')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CFNR';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DFS TRAINING ROOM', 'DFS TRAINING ROOM', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CFNR';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DFS-A3', 'DFS-A3', 1, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CFNR';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DFS-A5', 'DFS-A5', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CFNR';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DFS-AVR', 'DFS-AVR', 1, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CFNR';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DFS-B12', 'DFS-B12', 1, 'Capacity: 180')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CFNR';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DFS-C11', 'DFS-C11', 1, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CFNR';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DFS-C21', 'DFS-C21', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CFNR';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DFS-C22', 'DFS-C22', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CFNR';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DFS-C23', 'DFS-C23', 1, 'Capacity: 45')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CFNR';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ITEEM-LR', 'ITEEM-LR', 1, 'Capacity: 25')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DBM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ADE-215', 'ADE-215', 2, 'Capacity: 50')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DBM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ADE-216', 'ADE-216', 2, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DECON';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ECON-134', 'ECON-134', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DECON';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ECON-135', 'ECON-135', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DECON';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ECON-136', 'ECON-136', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DECON';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ECON-234', 'ECON-234', 2, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DECON';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ECON-235', 'ECON-235', 2, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DTHM-B1', 'DTHM-B1', 2, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DTHM-B2', 'DTHM-B2', 2, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DTHM-B3', 'DTHM-B3', 2, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DTHM-B4', 'DTHM-B4', 2, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DTHM-CTR', 'DTHM-CTR', 2, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DHM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DTHM-DEMO ROOM', 'DTHM-DEMO ROOM', 1, 'Capacity: 50')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DHM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DTHM-FOOD LABORATORY', 'DTHM-FOOD LABORATORY', 1, 'Capacity: 25')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DTHM-FR', 'DTHM-FR', 2, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DTHM-MEETING ROOM', 'DTHM-MEETING ROOM', 2, 'Capacity: 50')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DTHM-OFR /OFFICE ROOM', 'DTHM-OFR /OFFICE ROOM', 2, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'ISRDS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ISRDS TRAINING ROOM', 'ISRDS TRAINING ROOM', 1, 'Capacity: 50')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'NURS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'SKILLS LABORATORY', 'SKILLS LABORATORY', 1, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'NURS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'SMALL ROOM', 'SMALL ROOM', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'NURS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'STUDENT CENTER', 'STUDENT CENTER', 1, 'Capacity: 90')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ADE-131', 'ADE-131', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ADE-132', 'ADE-132', 1, 'Capacity: 50')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ADE-133', 'ADE-133', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ADE-213', 'ADE-213', 2, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ADE-214', 'ADE-214', 2, 'Capacity: 50')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ADE-236', 'ADE-236', 2, 'Capacity: 100')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ADE-237', 'ADE-237', 2, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DTE-AACCUP', 'DTE-AACCUP', 1, 'Capacity: 15')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'IHK';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'GYM', 'GYM', 1, 'Capacity: 600')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'IHK';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'IHK-101', 'IHK-101', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'IHK';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'IHK-102', 'IHK-102', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'IHK';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'IHK-103', 'IHK-103', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'IHK';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'IHK-104', 'IHK-104', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'IHK';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'IHK-Conf. Rm', 'IHK-Conf. Rm', 1, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'IHK';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'IHK-Dance Rm', 'IHK-Dance Rm', 1, 'Capacity: 30')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CVM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'VM-B1', 'VM-B1', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CVM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'VM-B12', 'VM-B12', 1, 'Capacity: 40')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CVM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'VM-B14', 'VM-B14', 1, 'Capacity: 50')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CVM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'VM-B2', 'VM-B2', 1, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CVM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'VM-C1', 'VM-C1', 1, 'Capacity: 20')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CVM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'VM-C11', 'VM-C11', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CVM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'VM-C12', 'VM-C12', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CVM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'VM-C13', 'VM-C13', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CVM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'VM-C14', 'VM-C14', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CVM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'VM-C4', 'VM-C4', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'CVM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'VM-C5', 'VM-C5', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;
