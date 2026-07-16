-- MASTER MIGRATION - GENERATED VIA DOCLING STRUCTURED EXTRACTION


INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Agronomy', 'da', 'Department of Agronomy', 'academic', true, 10.7461, 124.7933, 'DA')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Horticulture', 'doh', 'Department of Horticulture', 'academic', true, 10.7461, 124.7933, 'DOH')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Plant Breeding & Genetics', 'dpbg', 'Department of Plant Breeding & Genetics', 'academic', true, 10.7461, 124.7933, 'DPBG')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Pest Management', 'dpm', 'Department of Pest Management', 'academic', true, 10.7461, 124.7933, 'DPM')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Soil Science', 'dss', 'Department of Soil Science', 'academic', true, 10.7461, 124.7933, 'DSS')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Agricultural Education and Extension', 'daeex', 'Department of Agricultural Education and Extension', 'academic', true, 10.7461, 124.7933, 'DAEEX')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Animal Science', 'das', 'Department of Animal Science', 'academic', true, 10.7475, 124.7932, 'DAS')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Development Communication', 'ddc', 'Department of Development Communication', 'academic', true, 10.7447, 124.7949, 'DDC')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Food Science & Technology', 'dfst', 'Department of Food Science & Technology', 'academic', true, 10.7476, 124.7928, 'DFST')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Tourism Management', 'dtm', 'Department of Tourism Management', 'academic', true, 10.7451, 124.795, 'DTM')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Hospitality Management', 'dhm', 'Department of Hospitality Management', 'academic', true, 10.7451, 124.795, 'DHM')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Communication Arts Building', 'comart', 'Communication Arts Building', 'academic', true, 10.74182, 124.79019, 'COMART')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Home Science Building', 'homesci', 'Home Science Building', 'academic', true, 10.74173, 124.78992, 'HOMESCI')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Old VAC Administration Building', 'vacadmin', 'Old VAC Administration Building', 'academic', true, 10.74126, 124.79053, 'VACADMIN')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Mathematics and Natural Sciences Building', 'mathns', 'Mathematics and Natural Sciences Building', 'academic', true, 10.74066, 124.7909, 'MATHNS')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

-- ROOMS DATA

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DA';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DA - CONFERENCE ROOM DA PSB Rm-1', 'DA - CONFERENCE ROOM DA PSB Rm-1', 1, 'Capacity: 10')
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
    VALUES (fac_id, 'DA Rm-201 DA Rm-202', 'DA Rm-201 DA Rm-202', 2, 'Capacity: 30')
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
    VALUES (fac_id, 'DA Rm-203 / SMARTROOM', 'DA Rm-203 / SMARTROOM', 2, 'Capacity: 50')
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
    VALUES (fac_id, 'DAS-1 DAS-2', 'DAS-1 DAS-2', 1, 'Capacity: 45')
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
    VALUES (fac_id, 'DAS-3 DAS-5', 'DAS-3 DAS-5', 1, 'Capacity: 60')
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
    VALUES (fac_id, 'ADE-218 DDC-NEW ROOM', 'ADE-218 DDC-NEW ROOM', 2, 'Capacity: 45')
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
    VALUES (fac_id, 'DFSTFM Rm', 'DFSTFM Rm', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'DFST LECTURE ROOM DFST LIBRARY', 'DFST LECTURE ROOM DFST LIBRARY', 1, 'Capacity: 50')
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
    VALUES (fac_id, 'DFST PILOTROOM', 'DFST PILOTROOM', 1, 'Capacity: 60')
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
    VALUES (fac_id, 'DFST SENSORY ROOM DOH-101', 'DFST SENSORY ROOM DOH-101', 1, 'Capacity: 25')
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
    VALUES (fac_id, 'DOH-202 DOH-CropPhy (Hort)', 'DOH-202 DOH-CropPhy (Hort)', 2, 'Capacity: 35')
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
    VALUES (fac_id, 'DOH-Ornam DOH-Post har (Hort)', 'DOH-Ornam DOH-Post har (Hort)', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'DPBG LR-1', 'DPBG LR-1', 1, '')
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
    VALUES (fac_id, 'DPBG-204 DPBG-LH', 'DPBG-204 DPBG-LH', 2, 'Capacity: 40')
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
    VALUES (fac_id, 'DPBG-PSB 11 DPBG-PSB 12', 'DPBG-PSB 11 DPBG-PSB 12', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'DPM-101', 'DPM-101', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'DPM-102', 'DPM-102', 1, 'Capacity: 35')
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
    VALUES (fac_id, 'DPM-105 DPM-106', 'DPM-105 DPM-106', 1, 'Capacity: 35')
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
    VALUES (fac_id, 'DPM-107 DSS-116', 'DPM-107 DSS-116', 1, 'Capacity: 35')
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
    VALUES (fac_id, 'DSS-119', 'DSS-119', 1, '')
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
    VALUES (fac_id, 'DSS-205', 'DSS-205', 2, 'Capacity: 100')
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
    VALUES (fac_id, 'DSS-206 PSB-07 PSB-08', 'DSS-206 PSB-07 PSB-08', 2, 'Capacity: 50')
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
    VALUES (fac_id, 'DALL-2A1 DALL-2A2', 'DALL-2A1 DALL-2A2', 1, 'Capacity: 45')
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
    VALUES (fac_id, '', '', 1, 'Capacity: 45')
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
    VALUES (fac_id, 'DALL-7C DALL-ERR1', 'DALL-7C DALL-ERR1', 1, 'Capacity: 45')
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
    VALUES (fac_id, 'DBS-101 DBS-102', 'DBS-101 DBS-102', 1, 'Capacity: 60')
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
    VALUES (fac_id, 'DBS-104 DBS-105 DBS-106', 'DBS-104 DBS-105 DBS-106', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'DBS-AnaLab DBT-Lab1 DBT-Lab2', 'DBS-AnaLab DBT-Lab1 DBT-Lab2', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'DBT-LecR1 DBT-LecR2 DLABS-', 'DBT-LecR1 DBT-LecR2 DLABS-', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'AUDUTORIUM DMATH CONF ROOM', 'AUDUTORIUM DMATH CONF ROOM', 1, 'Capacity: 80')
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
    VALUES (fac_id, 'DMATH Lab DMath-LecR1', 'DMATH Lab DMath-LecR1', 1, 'Capacity: 20')
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
    VALUES (fac_id, 'DMath-LecR3 DMath-LecR4', 'DMath-LecR3 DMath-LecR4', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'AC-105 AC-106', 'AC-105 AC-106', 1, 'Capacity: 15')
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
    VALUES (fac_id, 'AC-208 AC-209A', 'AC-208 AC-209A', 2, 'Capacity: 30')
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
    VALUES (fac_id, 'AC-209B AC-210', 'AC-209B AC-210', 2, 'Capacity: 30')
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
    VALUES (fac_id, 'DPhys Comp.', 'DPhys Comp.', 1, 'Capacity: 35')
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
    VALUES (fac_id, 'Lab DPhys Lab 1', 'Lab DPhys Lab 1', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'DPhys Lab 2 DPhys Lab 3', 'DPhys Lab 2 DPhys Lab 3', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'DPhys Lec 1', 'DPhys Lec 1', 1, 'Capacity: 50')
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
    VALUES (fac_id, 'DPhys Lec 2 DPSS-10D', 'DPhys Lec 2 DPSS-10D', 1, 'Capacity: 45')
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
    VALUES (fac_id, 'DPSS-11D DPSS-12D', 'DPSS-11D DPSS-12D', 1, 'Capacity: 45')
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
    VALUES (fac_id, 'DPSS-13D DPSS-5B1', 'DPSS-13D DPSS-5B1', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'DPSS-9C DStat Lab 1 DStat Lab 2', 'DPSS-9C DStat Lab 1 DStat Lab 2', 1, 'Capacity: 45')
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
    VALUES (fac_id, '', '', 1, 'Capacity: 15')
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
    VALUES (fac_id, 'DStat Lab 3', 'DStat Lab 3', 1, 'Capacity: 25')
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
    VALUES (fac_id, 'DStat Lec 1', 'DStat Lec 1', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'DStat Lec 2 DStat LH', 'DStat Lec 2 DStat LH', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'CPB 01', 'CPB 01', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'CPB 02', 'CPB 02', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'EB-101 EB-105', 'EB-101 EB-105', 1, 'Capacity: 60')
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
    VALUES (fac_id, 'EB-202 SLH', 'EB-202 SLH', 2, 'Capacity: 60')
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
    VALUES (fac_id, 'EB-102 Anx EB-103 Anx', 'EB-102 Anx EB-103 Anx', 1, 'Capacity: 35')
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
    VALUES (fac_id, 'EB-107 DRAFTING Rm Soils Mech Lab.', 'EB-107 DRAFTING Rm Soils Mech Lab.', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'ICT-101 OFFICE', 'ICT-101 OFFICE', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'ICT-102 / ICT-103', 'ICT-102 / ICT-103', 1, 'Capacity: 24')
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
    VALUES (fac_id, 'ICT-201 ICT-202', 'ICT-201 ICT-202', 2, 'Capacity: 60')
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
    VALUES (fac_id, 'EB-201 Anx EB-202 Anx', 'EB-201 Anx EB-202 Anx', 2, 'Capacity: 40')
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
    VALUES (fac_id, 'DME-LR 1 DME-LR 2', 'DME-LR 1 DME-LR 2', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'DME-LR 4', 'DME-LR 4', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'EB-104 Anx EB-105 Anx EB-201 Comp. Lab DFS COMPUTER', 'EB-104 Anx EB-105 Anx EB-201 Comp. Lab DFS COMPUTER', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'DFS TRAINING ROOM DFS-A3', 'DFS TRAINING ROOM DFS-A3', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'DFS-AVR DFS-B12', 'DFS-AVR DFS-B12', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'DFS-C23 ITEEM-LR', 'DFS-C23 ITEEM-LR', 1, 'Capacity: 45')
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
    VALUES (fac_id, 'ADE-216 ECON-134', 'ADE-216 ECON-134', 2, 'Capacity: 40')
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
    VALUES (fac_id, 'ECON-136 ECON-234', 'ECON-136 ECON-234', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'ECON-235 DTHM-B1', 'ECON-235 DTHM-B1', 2, 'Capacity: 60')
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
    VALUES (fac_id, 'DTHM-B3 DTHM-B4', 'DTHM-B3 DTHM-B4', 2, 'Capacity: 30')
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
    VALUES (fac_id, 'DTHM-CTR', 'DTHM-CTR', 2, 'Capacity: 30')
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
    VALUES (fac_id, 'DTHM-DEMO ROOM DTHM-FOOD DTHM-FR', 'DTHM-DEMO ROOM DTHM-FOOD DTHM-FR', 1, 'Capacity: 50')
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
    VALUES (fac_id, 'LABORATORY', 'LABORATORY', 1, '')
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
    VALUES (fac_id, 'DTHM-MEETING ROOM DTHM-OFR /OFFICE ROOM ISRDS TRAINING ROOM', 'DTHM-MEETING ROOM DTHM-OFR /OFFICE ROOM ISRDS TRAINING ROOM', 2, 'Capacity: 50')
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
    VALUES (fac_id, 'SMALL ROOM STUDENT CENTER', 'SMALL ROOM STUDENT CENTER', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'ADE-131 ADE-132', 'ADE-131 ADE-132', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'ADE-213 ADE-214', 'ADE-213 ADE-214', 2, 'Capacity: 40')
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
    VALUES (fac_id, 'DTE-AACCUP GYM', 'DTE-AACCUP GYM', 1, 'Capacity: 600')
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
    VALUES (fac_id, 'IHK-103 IHK-104', 'IHK-103 IHK-104', 1, 'Capacity: 35')
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'CVM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'IHK-Dance Rm VM-B1 VM-B12', 'IHK-Dance Rm VM-B1 VM-B12', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'VM-C1', 'VM-C1', 1, '')
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
    VALUES (fac_id, 'VM-C11 VM-C12', 'VM-C11 VM-C12', 1, 'Capacity: 35')
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
    VALUES (fac_id, 'VM-C13 VM-C14', 'VM-C13 VM-C14', 1, 'Capacity: 35')
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
    VALUES (fac_id, 'VM-C4', 'VM-C4', 1, '')
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
    VALUES (fac_id, '', '', 1, '')
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
    VALUES (fac_id, '12', '12', 1, '')
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
    VALUES (fac_id, '35', '35', 1, '')
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
    VALUES (fac_id, '30', '30', 1, '')
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
    VALUES (fac_id, '50', '50', 1, '')
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
    VALUES (fac_id, '10', '10', 1, '')
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
    VALUES (fac_id, '60', '60', 1, '')
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
    VALUES (fac_id, '25', '25', 1, '')
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
    VALUES (fac_id, '60', '60', 1, '')
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
    VALUES (fac_id, '40', '40', 1, '')
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
    VALUES (fac_id, '50', '50', 1, '')
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
    VALUES (fac_id, '50', '50', 1, '')
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
    VALUES (fac_id, '40', '40', 1, '')
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
    VALUES (fac_id, '15', '15', 1, '')
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
    VALUES (fac_id, '25', '25', 1, '')
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
    VALUES (fac_id, '40', '40', 1, '')
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
    VALUES (fac_id, '75', '75', 1, '')
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
    VALUES (fac_id, '30', '30', 1, '')
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
    VALUES (fac_id, '50', '50', 1, '')
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
    VALUES (fac_id, '15', '15', 1, '')
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
    VALUES (fac_id, '30', '30', 1, '')
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
    VALUES (fac_id, '20', '20', 1, '')
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
    VALUES (fac_id, '50', '50', 1, '')
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
    VALUES (fac_id, '20', '20', 1, '')
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
    VALUES (fac_id, '50', '50', 1, 'Capacity: 60')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'VACADMIN';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'Room 2', 'Room 2', 1, '')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'COMART';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'Room 3', 'Room 3', 1, '')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'VACADMIN';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'Room 1', 'Room 1', 1, '')
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
    VALUES (fac_id, 'Room 8', 'Room 8', 1, '')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'COMART';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'Room 4', 'Room 4', 1, '')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'COMART';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'Room 2', 'Room 2', 1, '')
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
    VALUES (fac_id, 'Math Sci Bldg. AV Room', 'Math Sci Bldg. AV Room', 1, '')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'COMART';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'Room 7', 'Room 7', 1, '')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'COMART';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'Room 8', 'Room 8', 1, '')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'HOMESCI';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'Room 1', 'Room 1', 1, '')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'COMART';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'Room 5', 'Room 5', 1, '')
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
    VALUES (fac_id, 'Room 4', 'Room 4', 1, '')
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
    VALUES (fac_id, 'Room 7', 'Room 7', 1, '')
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
    VALUES (fac_id, 'Room 2', 'Room 2', 1, '')
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
    VALUES (fac_id, 'Room 3', 'Room 3', 1, '')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'VACADMIN';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'Room 3', 'Room 3', 1, '')
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
    VALUES (fac_id, 'Room 1', 'Room 1', 1, '')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'HOMESCI';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'Room 2', 'Room 2', 1, '')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'COMART';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'Room 6', 'Room 6', 1, '')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;
