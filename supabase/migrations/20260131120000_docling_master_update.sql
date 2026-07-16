-- MASTER MIGRATION - GENERATED VIA DOCLING DATA


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

-- ALL EXTRACTED ROOMS

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'Exclusive VetMed Laboratory Classes', 'Exclusive VetMed Laboratory Classes', 1, 'Capacity: 35')
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ICT-102', 'ICT-102', 1, 'Capacity: 24')
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ICT-202', 'ICT-202', 2, 'Capacity: 40')
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ADE', 'ADE', 1, 'Capacity: 131')
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
    VALUES (fac_id, 'n  T601     |                     | M584  SEREGENA RUTH Labastida MARTINEZ | Pred', 'n  T601     |                     | M584  SEREGENA RUTH Labastida MARTINEZ | Pred', 6, 'Capacity: 129')
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
    VALUES (fac_id, '| 2:30 - 3:00   | 15                   | M584  SEREGENA RUTH Labastida MARTINEZ | Pred', '| 2:30 - 3:00   | 15                   | M584  SEREGENA RUTH Labastida MARTINEZ | Pred', 5, 'Capacity: 129')
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
    VALUES (fac_id, 'CET CET DCST DCST', 'CET CET DCST DCST', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'CET DCE CET', 'CET DCE CET', 1, 'Capacity: 25')
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
    VALUES (fac_id, 'CME ISRDS Lec. CON DON Lec. & CON', 'CME ISRDS Lec. CON DON Lec. & CON', 1, 'Capacity: 60')
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
    VALUES (fac_id, 'DCE Lab.', 'DCE Lab.', 1, 'Capacity: 20')
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
    VALUES (fac_id, 'DFST CAFS DFST', 'DFST CAFS DFST', 1, 'Capacity: 60')
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
    VALUES (fac_id, 'CAFS DA', 'CAFS DA', 1, 'Capacity: 50')
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
    VALUES (fac_id, 'CAFS DAS', 'CAFS DAS', 1, 'Capacity: 12')
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
    VALUES (fac_id, 'CAFS DAS CAFS DAS', 'CAFS DAS CAFS DAS', 1, 'Capacity: 35')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;
