-- ROBUST MASTER MIGRATION - FIXING SHIFTED ROWS


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

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('VSU Integrated High School', 'highsc', 'VSU Integrated High School', 'academic', true, 10.7423, 124.7915, 'HIGHSC')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('College of Arts and Sciences', 'cas', 'College of Arts and Sciences', 'academic', true, 10.7431, 124.7942, 'CAS')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Mathematics', 'math', 'Department of Mathematics', 'academic', true, 10.7431, 124.7942, 'MATH')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Physics', 'phys', 'Department of Physics', 'academic', true, 10.7431, 124.7942, 'PHYS')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Pure & Applied Chemistry', 'chem', 'Department of Pure & Applied Chemistry', 'academic', true, 10.7431, 124.7942, 'CHEM')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Statistics', 'stat', 'Department of Statistics', 'academic', true, 10.7431, 124.7942, 'STAT')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Biotechnology', 'biotech', 'Department of Biotechnology', 'academic', true, 10.7431, 124.7942, 'BIOTECH')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Agricultural & Biosystems Engineering', 'dabe', 'Department of Agricultural & Biosystems Engineering', 'academic', true, 10.7455, 124.7935, 'DABE')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('College of Engineering & Technology', 'cet', 'College of Engineering & Technology', 'academic', true, 10.7455, 124.7935, 'CET')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Computer Science & Technology', 'csat', 'Department of Computer Science & Technology', 'academic', true, 10.7455, 124.7935, 'CSAT')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Geodetic Engineering', 'ge', 'Department of Geodetic Engineering', 'academic', true, 10.7455, 124.7935, 'GE')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Mechanical Engineering', 'mech', 'Department of Mechanical Engineering', 'academic', true, 10.7455, 124.7935, 'MECH')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('College of Forestry & Natural Resources', 'cfnr', 'College of Forestry & Natural Resources', 'academic', true, 10.7485, 124.7925, 'CFNR')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Business Management', 'dbm', 'Department of Business Management', 'academic', true, 10.7445, 124.7952, 'DBM')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Economics', 'decon', 'Department of Economics', 'academic', true, 10.7445, 124.7952, 'DECON')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Institute of Strategic Research & Development Studies', 'isrds', 'Institute of Strategic Research & Development Studies', 'academic', true, 10.7445, 124.7952, 'ISRDS')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('College of Nursing', 'nurs', 'College of Nursing', 'academic', true, 10.744, 124.7955, 'NURS')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Department of Teacher Education', 'dted', 'Department of Teacher Education', 'academic', true, 10.7435, 124.796, 'DTED')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('Institute of Human Kinetics', 'ihk', 'Institute of Human Kinetics', 'academic', true, 10.742, 124.797, 'IHK')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES ('College of Veterinary Medicine', 'cvm', 'College of Veterinary Medicine', 'academic', true, 10.75, 124.79, 'CVM')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;

-- ALL UNIQUE ROOMS

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DA';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'CONFERENCE ROOM', 'CONFERENCE ROOM', 1, 'Capacity: 10')
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
    VALUES (fac_id, 'Rm-1', 'Rm-1', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'Rm-2', 'Rm-2', 1, 'Capacity: 50')
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
    VALUES (fac_id, 'Rm-201', 'Rm-201', 2, 'Capacity: 30')
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
    VALUES (fac_id, 'Rm-202', 'Rm-202', 2, 'Capacity: 30')
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
    VALUES (fac_id, 'Rm-203', 'Rm-203', 2, 'Capacity: 50')
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
    VALUES (fac_id, 'Rm-10', 'Rm-10', 1, 'Capacity: 60')
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
    VALUES (fac_id, 'Rm-9', 'Rm-9', 1, 'Capacity: 60')
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
    VALUES (fac_id, 'CONFERENCE ROOM', 'CONFERENCE ROOM', 1, 'Capacity: 12')
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
    VALUES (fac_id, 'MEAT LABORATORY', 'MEAT LABORATORY', 1, 'Capacity: 35')
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'ADE-123', 'ADE-123', 1, 'Capacity: 20')
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
    VALUES (fac_id, 'LIBRARY', 'LIBRARY', 1, 'Capacity: 50')
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
    VALUES (fac_id, 'SENSORY ROOM', 'SENSORY ROOM', 1, 'Capacity: 25')
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
    VALUES (fac_id, 'DOH-05', 'DOH-05', 1, 'Capacity: 50')
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
    VALUES (fac_id, 'LR-1', 'LR-1', 1, '')
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
    VALUES (fac_id, 'Rm-6', 'Rm-6', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'DSS-206', 'DSS-206', 2, 'Capacity: 50')
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DSS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DALL-2', 'DALL-2', 1, 'Capacity: 45')
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
    VALUES (fac_id, 'DALL-2', 'DALL-2', 1, 'Capacity: 45')
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
    VALUES (fac_id, 'DALL-3', 'DALL-3', 1, 'Capacity: 45')
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
    VALUES (fac_id, 'DALL-4', 'DALL-4', 1, 'Capacity: 45')
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
    VALUES (fac_id, 'DALL-6', 'DALL-6', 1, 'Capacity: 45')
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
    VALUES (fac_id, 'DALL-7', 'DALL-7', 1, 'Capacity: 45')
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'BIOTECH';
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
    VALUES (fac_id, 'AUDUTORIUM', 'AUDUTORIUM', 1, 'Capacity: 80')
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
    VALUES (fac_id, 'DMath-LecR1', 'DMath-LecR1', 1, 'Capacity: 20')
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
    VALUES (fac_id, 'AC-208', 'AC-208', 2, 'Capacity: 30')
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
    VALUES (fac_id, 'AC-209', 'AC-209', 2, 'Capacity: 30')
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
    VALUES (fac_id, 'AC-210', 'AC-210', 2, 'Capacity: 30')
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
    VALUES (fac_id, 'DPhys Lab 1', 'DPhys Lab 1', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'DPhys Lab 2', 'DPhys Lab 2', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'DPhys Lab 3', 'DPhys Lab 3', 1, 'Capacity: 20')
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
    VALUES (fac_id, 'DPSS-10', 'DPSS-10', 1, 'Capacity: 45')
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
    VALUES (fac_id, 'DPSS-11', 'DPSS-11', 1, 'Capacity: 45')
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
    VALUES (fac_id, 'DPSS-12', 'DPSS-12', 1, 'Capacity: 45')
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
    VALUES (fac_id, 'DPSS-13', 'DPSS-13', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'DPSS-5', 'DPSS-5', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'DPSS-8', 'DPSS-8', 1, 'Capacity: 45')
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
    VALUES (fac_id, 'DPSS-9', 'DPSS-9', 1, 'Capacity: 45')
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
    VALUES (fac_id, 'DStat Lab 1', 'DStat Lab 1', 1, 'Capacity: 15')
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
    VALUES (fac_id, 'DStat Lab 2', 'DStat Lab 2', 1, 'Capacity: 45')
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'CET';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-101', 'EB-101', 1, 'Capacity: 60')
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'CET';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'CET';
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
    VALUES (fac_id, 'MTLR', 'MTLR', 1, 'Capacity: 20')
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
    VALUES (fac_id, 'EB-102', 'EB-102', 1, 'Capacity: 35')
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
    VALUES (fac_id, 'EB-103', 'EB-103', 1, 'Capacity: 35')
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
    VALUES (fac_id, 'EB-107', 'EB-107', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'ICT-202', 'ICT-202', 2, 'Capacity: 60')
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'CET';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'EB-201', 'EB-201', 2, 'Capacity: 40')
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
    VALUES (fac_id, 'EB-203', 'EB-203', 2, 'Capacity: 40')
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
    VALUES (fac_id, 'EB-104', 'EB-104', 1, 'Capacity: 40')
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'DTED';
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
    VALUES (fac_id, 'ECON-234', 'ECON-234', 2, 'Capacity: 40')
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'CVM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'VM-B1', 'VM-B1', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'VM-C5', 'VM-C5', 1, 'Capacity: 35')
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
    VALUES (fac_id, '0', '0', 1, '')
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
    VALUES (fac_id, '6', '6', 1, '')
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
    VALUES (fac_id, '7', '7', 1, '')
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
    VALUES (fac_id, '2', '2', 1, '')
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
    VALUES (fac_id, '4', '4', 1, '')
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
    VALUES (fac_id, '3', '3', 1, '')
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'CVM';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, '5', '5', 1, '')
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
    VALUES (fac_id, '1', '1', 1, '')
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
    VALUES (fac_id, '8', '8', 1, '')
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
    VALUES (fac_id, '11', '11', 1, '')
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
    VALUES (fac_id, '189', '189', 1, '')
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
    VALUES (fac_id, 'Capacity', 'Capacity', 1, 'Capacity: Remarks')
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
    VALUES (fac_id, '30', '30', 1, 'Capacity: OK')
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
    VALUES (fac_id, '40', '40', 1, 'Capacity: OK')
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
    VALUES (fac_id, '25', '25', 1, 'Capacity: DELETED')
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
    VALUES (fac_id, '30', '30', 1, 'Capacity: OK')
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
    VALUES (fac_id, '80', '80', 1, 'Capacity: OK')
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
    VALUES (fac_id, '12', '12', 1, 'Capacity: OK')
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
    VALUES (fac_id, '35', '35', 1, 'Capacity: OK')
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
    VALUES (fac_id, '45', '45', 1, 'Capacity: OK')
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
    VALUES (fac_id, '60', '60', 1, 'Capacity: OK')
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
    VALUES (fac_id, '30', '30', 1, 'Capacity: DELETED')
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
    VALUES (fac_id, '35', '35', 1, 'Capacity: OK')
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
    VALUES (fac_id, '12', '12', 1, 'Capacity: OK')
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
    VALUES (fac_id, '60', '60', 1, 'Capacity: OK')
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
    VALUES (fac_id, '30', '30', 1, 'Capacity: OK')
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
    VALUES (fac_id, '40', '40', 1, 'Capacity: OK')
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
    VALUES (fac_id, '24', '24', 1, 'Capacity: OK')
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
    VALUES (fac_id, '20', '20', 1, 'Capacity: OK')
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
    VALUES (fac_id, '60', '60', 1, 'Capacity: OK')
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
    VALUES (fac_id, '30', '30', 1, 'Capacity: OK')
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
    VALUES (fac_id, '20', '20', 1, 'Capacity: OK')
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
    VALUES (fac_id, '45', '45', 1, 'Capacity: OK')
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
    VALUES (fac_id, '45', '45', 1, 'Capacity: OK')
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
    VALUES (fac_id, '30', '30', 1, 'Capacity: OK')
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
    VALUES (fac_id, '50', '50', 1, 'Capacity: OK')
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
    VALUES (fac_id, 'Capacity', 'Capacity', 1, 'Capacity: Remarks')
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
    VALUES (fac_id, '10', '10', 1, 'Capacity: OK')
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
    VALUES (fac_id, '60', '60', 1, 'Capacity: OK')
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
    VALUES (fac_id, '25', '25', 1, 'Capacity: OK')
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
    VALUES (fac_id, '60', '60', 1, 'Capacity: OK')
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
    VALUES (fac_id, '40', '40', 1, 'Capacity: OK')
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
    VALUES (fac_id, '80', '80', 1, 'Capacity: OK')
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
    VALUES (fac_id, '40', '40', 1, 'Capacity: OK')
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
    VALUES (fac_id, '60', '60', 1, 'Capacity: OK')
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
    VALUES (fac_id, '80', '80', 1, 'Capacity: OK')
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
    VALUES (fac_id, '35', '35', 1, 'Capacity: OK')
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
    VALUES (fac_id, '30', '30', 1, 'Capacity: OK')
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
    VALUES (fac_id, '50', '50', 1, 'Capacity: OK')
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
    VALUES (fac_id, '15', '15', 1, 'Capacity: OK')
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
    VALUES (fac_id, '20', '20', 1, 'Capacity: OK')
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
    VALUES (fac_id, '30', '30', 1, 'Capacity: OK')
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
    VALUES (fac_id, '35', '35', 1, 'Capacity: OK')
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
    VALUES (fac_id, '40', '40', 1, 'Capacity: OK')
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
    VALUES (fac_id, '100', '100', 1, 'Capacity: OK')
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
    VALUES (fac_id, 'Capacity', 'Capacity', 1, 'Capacity: Remarks')
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
    VALUES (fac_id, '35', '35', 1, 'Capacity: OK')
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
    VALUES (fac_id, '40', '40', 1, 'Capacity: OK')
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
    VALUES (fac_id, '50', '50', 1, 'Capacity: OK')
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
    VALUES (fac_id, '100', '100', 1, 'Capacity: OK')
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
    VALUES (fac_id, '60', '60', 1, 'Capacity: OK')
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
    VALUES (fac_id, '15', '15', 1, 'Capacity: OK')
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
    VALUES (fac_id, '1000', '1000', 1, 'Capacity: OK')
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
    VALUES (fac_id, '35', '35', 1, 'Capacity: OK')
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
    VALUES (fac_id, '30', '30', 1, 'Capacity: OK')
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
    VALUES (fac_id, '50', '50', 1, 'Capacity: OK')
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
    VALUES (fac_id, '1000', '1000', 1, 'Capacity: OK')
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
    VALUES (fac_id, '40', '40', 1, 'Capacity: DELETED')
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
    VALUES (fac_id, '0', '0', 1, 'Capacity: DELETED')
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
    VALUES (fac_id, '25', '25', 1, 'Capacity: OK')
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
    VALUES (fac_id, '40', '40', 1, 'Capacity: OK')
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
    VALUES (fac_id, '30', '30', 1, 'Capacity: OK')
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
    VALUES (fac_id, '60', '60', 1, 'Capacity: OK')
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
    VALUES (fac_id, 'Capacity', 'Capacity', 1, 'Capacity: Remarks')
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
    VALUES (fac_id, '90', '90', 1, 'Capacity: OK')
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
    VALUES (fac_id, '50', '50', 1, 'Capacity: OK')
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
    VALUES (fac_id, '20', '20', 1, 'Capacity: OK')
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
    VALUES (fac_id, '35', '35', 1, 'Capacity: OK')
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
    VALUES (fac_id, '50', '50', 1, 'Capacity: OK')
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
    VALUES (fac_id, '40', '40', 1, 'Capacity: OK')
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
    VALUES (fac_id, '60', '60', 1, 'Capacity: OK')
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
    VALUES (fac_id, '180', '180', 1, 'Capacity: OK')
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
    VALUES (fac_id, '30', '30', 1, 'Capacity: OK')
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
    VALUES (fac_id, '45', '45', 1, 'Capacity: OK')
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
    VALUES (fac_id, '60', '60', 2, 'Capacity: OK')
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
    VALUES (fac_id, '30', '30', 2, 'Capacity: OK')
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
    VALUES (fac_id, '50', '50', 2, 'Capacity: OK')
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
    VALUES (fac_id, '25', '25', 2, 'Capacity: OK')
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
    VALUES (fac_id, '40', '40', 2, 'Capacity: OK')
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
    VALUES (fac_id, 'Capacity', 'Capacity', 2, 'Capacity: Remarks')
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
    VALUES (fac_id, '15', '15', 1, 'Capacity: OK')
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
    VALUES (fac_id, '25', '25', 1, 'Capacity: OK')
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
    VALUES (fac_id, '40', '40', 1, 'Capacity: OK')
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
    VALUES (fac_id, '15', '15', 1, 'Capacity: OK')
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
    VALUES (fac_id, '25', '25', 1, 'Capacity: OK')
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
    VALUES (fac_id, '40', '40', 1, 'Capacity: OK')
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
    VALUES (fac_id, '75', '75', 1, 'Capacity: OK')
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
    VALUES (fac_id, '50', '50', 1, 'Capacity: OK')
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
    VALUES (fac_id, '15', '15', 1, 'Capacity: OK')
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
    VALUES (fac_id, '30', '30', 1, 'Capacity: OK')
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
    VALUES (fac_id, '20', '20', 1, 'Capacity: OK')
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
    VALUES (fac_id, '50', '50', 1, 'Capacity: OK')
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
    VALUES (fac_id, '40', '40', 1, 'Capacity: OK')
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
    VALUES (fac_id, '25', '25', 1, 'Capacity: OK')
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
    VALUES (fac_id, '1000', '1000', 1, 'Capacity: OK')
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
    VALUES (fac_id, '25', '25', 1, 'Capacity: OK')
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
    VALUES (fac_id, 'Capacity', 'Capacity', 1, 'Capacity: Remarks')
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
    VALUES (fac_id, '100', '100', 1, 'Capacity: OK')
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
    VALUES (fac_id, '50', '50', 1, 'Capacity: OK')
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
    VALUES (fac_id, '10', '10', 1, 'Capacity: OK')
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
    VALUES (fac_id, '10', '10', 1, 'Capacity: -')
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
    VALUES (fac_id, '20', '20', 1, 'Capacity: OK')
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
    VALUES (fac_id, '60', '60', 1, 'Capacity: OK')
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
    VALUES (fac_id, '40', '40', 1, 'Capacity: OK')
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
    VALUES (fac_id, '35', '35', 1, 'Capacity: OK')
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
    VALUES (fac_id, '20', '20', 1, 'Capacity: OK')
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
    VALUES (fac_id, '35', '35', 1, 'Capacity: OK')
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
    VALUES (fac_id, '45', '45', 1, 'Capacity: OK')
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
    VALUES (fac_id, 'Capacity', 'Capacity', 1, 'Capacity: Remarks')
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
    VALUES (fac_id, '40', '40', 1, 'Capacity: OK')
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
    VALUES (fac_id, '90', '90', 1, 'Capacity: 89')
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
    VALUES (fac_id, '40', '40', 1, 'Capacity: 25')
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
    VALUES (fac_id, '440', '440', 4, '')
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
    VALUES (fac_id, '460', '460', 4, '')
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
    VALUES (fac_id, '400', '400', 4, 'Capacity: 409')
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
    VALUES (fac_id, '70', '70', 1, 'Capacity: 72')
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
    VALUES (fac_id, '75', '75', 1, 'Capacity: 70')
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
    VALUES (fac_id, '545', '545', 5, '')
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
    VALUES (fac_id, '80', '80', 1, 'Capacity: 92')
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
    VALUES (fac_id, '200', '200', 2, 'Capacity: 196')
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
    VALUES (fac_id, '100', '100', 1, 'Capacity: 110')
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
    VALUES (fac_id, '400', '400', 4, '')
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
    VALUES (fac_id, '80', '80', 1, 'Capacity: 92')
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
    VALUES (fac_id, '140', '140', 1, '')
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
    VALUES (fac_id, 'Gabaldon Bldg. Room 2', 'Gabaldon Bldg. Room 2', 1, '')
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
    VALUES (fac_id, 'Comm Arts. Bldg. Room 3', 'Comm Arts. Bldg. Room 3', 1, '')
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
    VALUES (fac_id, 'Gabaldon Bldg. Room 1', 'Gabaldon Bldg. Room 1', 1, '')
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
    VALUES (fac_id, 'Class Room', 'Class Room', 1, '')
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
    VALUES (fac_id, 'Math Sci Bldg. Room 8', 'Math Sci Bldg. Room 8', 1, '')
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
    VALUES (fac_id, 'Comm Arts Bldg. Room 4', 'Comm Arts Bldg. Room 4', 1, '')
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
    VALUES (fac_id, 'Comm Arts Bldg. Room 8', 'Comm Arts Bldg. Room 8', 1, '')
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
    VALUES (fac_id, 'Home Scie Bldg. Room 1', 'Home Scie Bldg. Room 1', 1, '')
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
    VALUES (fac_id, 'Math Sci Bldg. Room 2', 'Math Sci Bldg. Room 2', 1, '')
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
    VALUES (fac_id, 'Math Sci Bldg. Room 3', 'Math Sci Bldg. Room 3', 1, '')
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
    VALUES (fac_id, 'Gabaldon Bldg.  Room 3', 'Gabaldon Bldg.  Room 3', 1, '')
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
    VALUES (fac_id, 'Math Sci Bldg. Room 1', 'Math Sci Bldg. Room 1', 1, '')
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
    VALUES (fac_id, 'Home Science Bldg. Room 2', 'Home Science Bldg. Room 2', 1, '')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;
