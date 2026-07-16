-- Adding remaining missing rooms from robust PDF extraction (Fixed)

INSERT INTO facilities (name, slug, description, category, has_rooms, latitude, longitude, code)
VALUES (
  'Department of Agricultural Education and Extension', 
  'daeex', 
  'Agricultural Education and Extension Building', 
  'academic', 
  true, 
  10.7461, 
  124.7933, 
  'DAEEX'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

DO $$
DECLARE
  fac_id UUID;
BEGIN
  SELECT id INTO fac_id FROM facilities WHERE code = 'DAEEX';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES 
      (fac_id, 'PSB Rm-9', 'PSB Rm-9', 1, 'Capacity: 60'),
      (fac_id, 'PSB Rm-10', 'PSB Rm-10', 1, 'Capacity: 60')
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
    VALUES (fac_id, 'DPBG-PSB 12', 'DPBG-PSB 12', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'DPhys Lec 2', 'DPhys Lec 2', 1, 'Capacity: 50')
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'STAT';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DStat Lab 2', 'DStat Lab 2', 1, 'Capacity: 15')
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
    VALUES (fac_id, 'DStat Lec 2', 'DStat Lec 2', 1, 'Capacity: 40')
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'MECH';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'DME-LR 1', 'DME-LR 1', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'DME-LR 2', 'DME-LR 2', 1, 'Capacity: 40')
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'MATHNS';
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
  SELECT id INTO fac_id FROM facilities WHERE code = 'CAS';
  IF fac_id IS NOT NULL THEN
    INSERT INTO rooms (facility_id, room_code, name, floor, description)
    VALUES (fac_id, 'CFNR-AVR', 'CFNR-AVR', 1, '')
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
    VALUES (fac_id, 'DOH-SeedTech (Hort)', 'DOH-SeedTech (Hort)', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'FIELD', 'FIELD', 1, 'Capacity: 1000')
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
    VALUES (fac_id, 'ODS-AVR', 'ODS-AVR', 1, 'Capacity: 40')
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
    VALUES (fac_id, 'USSO-SM', 'USSO-SM', 1, '')
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
    VALUES (fac_id, 'USSO-SR', 'USSO-SR', 1, '')
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
    VALUES (fac_id, 'DFS- AVR', 'DFS- AVR', 1, 'Capacity: 60')
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
    VALUES (fac_id, 'DTHM-FOOR LABORATORY', 'DTHM-FOOR LABORATORY', 1, 'Capacity: 25')
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
    VALUES (fac_id, 'DTHM-OFR', 'DTHM-OFR', 1, 'Capacity: 30')
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
    VALUES (fac_id, 'ODREX-131', 'ODREX-131', 1, 'Capacity: 50')
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
    VALUES (fac_id, 'ODREX-134', 'ODREX-134', 1, 'Capacity: 60')
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
    VALUES (fac_id, 'ODREX-135', 'ODREX-135', 1, 'Capacity: 60')
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
    VALUES (fac_id, 'TBA', 'TBA', 1, 'Capacity: 10000')
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
    VALUES (fac_id, 'Virtual Room', 'Virtual Room', 1, 'Capacity: 1000')
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
    VALUES (fac_id, 'DSS-207 (NF)', 'DSS-207 (NF)', 2, 'Capacity: 25')
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
    VALUES (fac_id, 'DA Rm-203', 'DA Rm-203', 2, 'Capacity: 50')
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
    VALUES (fac_id, 'UTILITY ROOM', 'UTILITY ROOM', 1, 'Capacity: 10')
    ON CONFLICT (facility_id, room_code) DO UPDATE SET
      description = EXCLUDED.description,
      floor = EXCLUDED.floor;
  END IF;
END $$;
