-- Expand abbreviations in Facility Names

DO $$
BEGIN
  -- Department -> Dept.
  UPDATE facilities SET name = REPLACE(name, 'Dept.', 'Department') WHERE name LIKE '%Dept.%';
  
  -- Management -> Mgmt
  UPDATE facilities SET name = REPLACE(name, 'Mgmt', 'Management') WHERE name LIKE '%Mgmt%';
  
  -- Agriculture -> Ag.
  UPDATE facilities SET name = REPLACE(name, 'Ag.', 'Agriculture') WHERE name LIKE '%Ag.%';
  
  -- Science -> Sci.
  UPDATE facilities SET name = REPLACE(name, 'Sci.', 'Science') WHERE name LIKE '%Sci.%';
  
  -- Technology -> Tech. or Tech (handle Tech. first)
  UPDATE facilities SET name = REPLACE(name, 'Tech.', 'Technology') WHERE name LIKE '%Tech.%';
  -- Also handle "Tech" without dot if it appears as a word, but be careful (e.g., Biotech is fine, but "Tech" word is short).
  -- "Info. & Comms. Technology Bldg" -> Tech is full.
  -- "Dept. of Food Sci. & Tech." -> Tech.
  
  -- Development -> Dev.
  UPDATE facilities SET name = REPLACE(name, 'Dev.', 'Development') WHERE name LIKE '%Dev.%';
  
  -- Information -> Info.
  UPDATE facilities SET name = REPLACE(name, 'Info.', 'Information') WHERE name LIKE '%Info.%';
  
  -- Communications -> Comms.
  UPDATE facilities SET name = REPLACE(name, 'Comms.', 'Communications') WHERE name LIKE '%Comms.%';
  
  -- Institute -> Inst.
  UPDATE facilities SET name = REPLACE(name, 'Inst.', 'Institute') WHERE name LIKE '%Inst.%';
  
  -- Building -> Bldg (Only replace Bldg if it's abbreviated)
  UPDATE facilities SET name = REPLACE(name, 'Bldg', 'Building') WHERE name LIKE '%Bldg%';
  
  -- Highschool -> Highschool (Already full word? HSART is "Highschool Arts...").
  -- "Info. & Comms. Technology Bldg" -> "Information & Communications Technology Building"
  
  -- Pure & Applied Chemistry "Dept. of Pure..." -> "Department of Pure..." (Handled by Dept.)
  
  -- Engineering (Eng'g?) - seed uses Engineering.
  
  -- Special cases from seed.sql that might have other abbrs:
  -- "Inst. of Strategic Research & Dev. Studies" -> "Institute of Strategic Research & Development Studies" (Handled by Inst. and Dev.)
  -- "College of Ag. & Food Science (Office)" -> "College of Agriculture & Food Science (Office)" (Handled by Ag.)
  
END $$;
