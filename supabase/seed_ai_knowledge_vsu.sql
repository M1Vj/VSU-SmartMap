BEGIN;

CREATE TEMP TABLE seed_ai_knowledge_entries (
  title text PRIMARY KEY,
  content text NOT NULL,
  keywords text[] NOT NULL,
  source text,
  priority integer NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_ai_knowledge_entries (title, content, keywords, source, priority) VALUES
(
  'VSU SmartMap Assistant identity and creator',
  'VSU SmartMap Campus Assistant is part of the VSU SmartMap Web project. It helps students, visitors, and staff find buildings, offices, rooms, dormitories, food areas, landmarks, events, and other campus facilities. If asked who created the project or assistant, answer that it was created and developed by Vj F. Mabansag, a Third Year BS Computer Science student at Visayas State University. Keep this answer short and non-technical unless the user asks for technical details.',
  ARRAY['smartmap','assistant','creator','vj mabansag','project','campus map','chatbot']::text[],
  'seed:campus-assistant-prompt',
  100
),
(
  'VSU SmartMap Assistant language and response style',
  'Answer in the same language style as the user. If the user speaks Tagalog or Taglish, reply in natural Taglish. If the user writes mostly English, reply in English. Keep answers short, friendly, calm, and useful. Avoid long lectures. If information is not verified by admin knowledge, facility data, or event data, say that verified information is not available instead of guessing.',
  ARRAY['chatbot behavior','taglish','english','tone','verified information','answer style']::text[],
  'seed:campus-assistant-prompt',
  98
),
(
  'VSU SmartMap location matching rules',
  'When a user asks for a campus location, match exact or near-exact facility names, common shortened names, building codes, rooms, and categories. Examples: Admin may mean Administration Building; CR may mean comfort room or restroom; canteen, kainan, or food court may refer to dining facilities; clinic may refer to the infirmary or health facility; gym may refer to the gymnasium. If a query is ambiguous, give up to 6 likely options and ask a focused clarification.',
  ARRAY['location search','facility matching','rooms','building codes','cr','canteen','gym','clinic','admin']::text[],
  'seed:campus-assistant-prompt',
  96
),
(
  'VSU SmartMap room code and subject code guidance',
  'If the user asks for a specific room code such as ICT101, CAS-201, or Lab A, search for the parent building that contains that room and say the room is inside that building. If the user asks for something that looks like a subject or course code, such as CSci 108 or G067, clarify that it may be a subject code and ask the user to check the Room Assignment in their schedule or COR.',
  ARRAY['room code','subject code','course code','cor','schedule','room assignment','ICT101','CSci']::text[],
  'seed:campus-assistant-prompt',
  95
),
(
  'TBA locations on VSU schedules',
  'TBA means To Be Announced. It is not a physical location on the map. If a student asks where TBA is, explain that the room or venue has not been announced yet. Tell them to check their student portal, class group chat, instructor announcement, or official VSU channels for the final room assignment.',
  ARRAY['tba','to be announced','schedule','room assignment','student portal','instructor']::text[],
  'seed:campus-assistant-prompt',
  94
),
(
  'VSU SmartMap directions and route limits',
  'The map can show campus locations and route options inside the VSU campus area. The chat assistant should not invent exact turn-by-turn instructions, live GPS movement, or precise ETA from text alone. If the user wants navigation, tell them to open the Map tab, select the destination pin, and use Directions. If live location is unavailable or outside campus, use a manual start pin inside the VSU campus map.',
  ARRAY['directions','route','pathfinding','gps','manual start pin','navigation','map tab','eta']::text[],
  'seed:campus-assistant-prompt',
  94
),
(
  'VSU SmartMap emergency and security guidance',
  'For urgent security, safety, medical, or emergency concerns, do not rely only on the chatbot. Direct the user to nearby guards, guard house or entrance facilities if available in the map, the VSU Infirmary for health concerns, and official university or local emergency channels. Keep the response short and action-oriented.',
  ARRAY['emergency','security','guard','guard house','infirmary','medical','safety','help']::text[],
  'seed:campus-assistant-prompt',
  93
),
(
  'Visayas State University overview and main contact',
  'Visayas State University is located in Visca, Baybay City, Leyte, Philippines 6521. VSU describes itself as a leading global university in agriculture and allied fields, with its flagship main campus in Baybay City. Main contact details from the official website: trunkline +63 (53) 565 0600, fax +63 (53) 563 7067, and email uimpa@vsu.edu.ph.',
  ARRAY['vsu','visayas state university','contact','address','baybay','leyte','trunkline','uimpa']::text[],
  'https://www.vsu.edu.ph/about',
  92
),
(
  'VSU history timeline',
  'VSU traces its roots to Baybay Agricultural School, established on June 2, 1924. It became Baybay Agricultural High School in 1934, Baybay National Agricultural School in 1938, Visayas Agricultural College in 1960, Visayas State College of Agriculture in 1974, Leyte State University in 2001, and Visayas State University in 2007. Use this only for general history questions and cite official VSU pages when needed.',
  ARRAY['vsu history','baybay agricultural school','visca','leyte state university','1924','2007']::text[],
  'https://www.vsu.edu.ph/about/overview/the-university',
  91
),
(
  'VSU main campus land area and facilities',
  'VSU Main Campus covers about 1,099.4 hectares, extending from the shore of Camotes Sea to Mt. Pangasugan. Official VSU information lists 188 main-campus buildings, including student dormitories, staff houses, academic buildings, administration buildings, Main Library, Student Union, Convention Center, Center for Continuing Education, Infirmary, Guesthouse, Hostel, Pavilion, market, cafeteria, gymnatorium, marine laboratory, workshops, research and training centers, and other facilities.',
  ARRAY['campus facilities','main campus','land area','camotes sea','mt pangasugan','buildings','dormitories','library','infirmary']::text[],
  'https://www.vsu.edu.ph/about/overview',
  90
),
(
  'VSU faculties and campuses',
  'VSU lists these faculties on its official site: Agriculture; Computing; Humanities and Social Sciences; Education; Engineering; Forestry and Environmental Sciences; Management and Economics; Natural and Mathematical Sciences; Nursing; Veterinary Medicine. VSU component campuses include Alangalang, Isabel, Tolosa, and Villaba, in addition to the main campus in Baybay.',
  ARRAY['faculties','colleges','campuses','alangalang','isabel','tolosa','villaba','baybay']::text[],
  'https://www.vsu.edu.ph/about',
  89
),
(
  'VSU undergraduate programs at Main Campus',
  'VSU Main Campus undergraduate offerings include programs under Agriculture and Food Sciences, Humanities and Social Sciences, Natural and Mathematical Sciences, Computing, Teacher Education, Engineering, Forestry and Environmental Sciences, Management and Economics, Nursing, and Veterinary Medicine. Examples include BS Agriculture, BS Development Communication, BS Food Technology, AB English Language Studies, AB Philosophy, BS Biology, BS Computer Science, teacher education programs, engineering programs, BS Forestry, BS Environmental Science, BS Agribusiness, BS Economics, BS Hospitality Management, BS Tourism Management, BS Nursing, and Doctor of Veterinary Medicine.',
  ARRAY['undergraduate programs','main campus','bs agriculture','bs computer science','engineering','nursing','veterinary medicine','education']::text[],
  'https://www.vsu.edu.ph/admission/college',
  88
),
(
  'VSU component campus undergraduate programs',
  'VSU component campuses offer selected undergraduate programs. Alangalang includes Elementary Education, Agriculture, Environmental Science, Information Technology, and Secondary Education. Isabel includes English Language Studies, Elementary Education, Physical Education, Agribusiness, Civil Engineering, Industrial Engineering, Information Technology, Mechanical Engineering, and Secondary Education. Villaba includes Elementary Education, Physical Education, Agriculture majors, and Secondary Education. Tolosa includes Elementary Education, Physical Education, Criminology, Fisheries, Industrial Security Management, Marine Biology, and Secondary Education.',
  ARRAY['component campuses','alangalang','isabel','villaba','tolosa','undergraduate programs']::text[],
  'https://www.vsu.edu.ph/admission/college',
  87
),
(
  'VSU College Admission Test basics',
  'For VSUCAT, official VSU admission information says the admission rating is computed as 70% VSUCAT score and 30% GPA. Applicants generally need a final admission rating of at least 60% and must be within the approved quota of the chosen degree program. Equity Target Group, athlete, and artist applicants may qualify from 40% to below 60%, subject to ranking, slots, and document verification. Requirements and schedules change, so direct applicants to the official VSU admissions page for current details.',
  ARRAY['vsucat','admission','college admission test','gpa','quota','equity target group','applicants']::text[],
  'https://www.vsu.edu.ph/admission',
  86
),
(
  'VSU enrollment process for incoming students',
  'VSU introduced a one-stop shop enrollment process for incoming students to reduce long queues and confusion. The official guide includes setting an online appointment before going to the enrollment site, attending a short guidance counselor intake session, bringing one long white folder, and submitting original admission requirements to the Admissions Office. Incomplete submissions may not be accepted, except some conditional cases noted by VSU. Always check the latest official #EnrollAtVSU page for current schedules and document lists.',
  ARRAY['enrollment','enroll at vsu','incoming students','appointment','admissions office','requirements','guidance counselor']::text[],
  'https://www.vsu.edu.ph/admission/college/enrollment-process',
  86
),
(
  'VSU Office of the University Registrar contact',
  'For registrar concerns, official VSU program pages list the Office of the University Registrar at the Administration Building, Visayas State University. The undergraduate programs page lists Mr. Raymund Igcasama as University Registrar, telephone +63 53 563 7428, and email registrar@vsu.edu.ph. Another official contact page lists Office of the Registrar phone numbers +63 53 335 2644 / 563 7428. For records, enrollment, registration, and credentials, tell users to contact the Registrar directly.',
  ARRAY['registrar','office of the university registrar','records','registration','credentials','enrollment','raymund igcasama']::text[],
  'https://www.vsu.edu.ph/admission/college',
  85
),
(
  'VSU student services through USSO',
  'The University Student Services Office (USSO) lists student welfare, development, and institutional services. Services include guidance and counseling, information and orientation, testing and appraisal, follow-up, career and job placement, student organization recognition, scholarship and financial assistance, student housing, campus ministry, social and community engagement, and undergraduate admission services. Some services may have fees, such as testing and student organization registration, based on official USSO information.',
  ARRAY['usso','student services','guidance','counseling','career','job placement','scholarship','student housing','student organization']::text[],
  'https://www.vsu.edu.ph/21-content-main/informational/1156-student-services',
  84
),
(
  'VSU Learning Commons Library hours and services',
  'VSU Learning Commons Library hours from its official site: weekdays 7:00 AM to 6:00 PM with no noon break; Saturdays 8:00 AM to 5:00 PM with noon break from 12:00 PM to 1:00 PM; term breaks and summer terms Monday to Friday 8:00 AM to 5:00 PM with no noon break. The library supports academic and research needs with books, journals, digital resources, multimedia materials, quiet study areas, collaborative spaces, computer labs, and staff assistance.',
  ARRAY['library','learning commons','library hours','books','journals','study area','computer lab','research']::text[],
  'https://library.vsu.edu.ph/home.php',
  84
),
(
  'VSU portals: my.VSU and e-learning',
  'The official VSU site describes my.VSU as a student portal for grades, subjects, schedules, and more. Some VSU pages also refer to the VSU E-Learning Portal as a resource for course requirements and helpful materials. If a student asks about grades, subjects, schedules, or room assignments, advise them to check my.VSU or official class/instructor announcements.',
  ARRAY['my.vsu','student portal','grades','subjects','schedule','e-learning','room assignment']::text[],
  'https://www.vsu.edu.ph/',
  83
),
(
  'VSU academic calendar and event announcements',
  'VSU publishes an academic calendar page containing the approved academic calendar and university events. VSU units, student organizations, and groups can submit announcements or content to uimpa@vsu.edu.ph for inclusion in the calendar, LED Wall, and social media pages. For official dates such as exams, enrollment, graduation, and university events, advise users to check the VSU calendar or official announcements.',
  ARRAY['academic calendar','events','announcements','exam schedule','graduation','uimpa','led wall']::text[],
  'https://www.vsu.edu.ph/articles/calendar',
  82
),
(
  'VSU official Facebook page',
  'The official Facebook page is Visayas State University | Baybay at https://www.facebook.com/visayasstateu/. Facebook content may require login, so the chatbot should not claim live Facebook details unless they are provided in admin knowledge or event data. For latest urgent announcements, tell users to check the official VSU website, VSU calendar, and official Facebook page.',
  ARRAY['facebook','official page','announcements','social media','visayasstateu','latest updates']::text[],
  'https://www.facebook.com/visayasstateu/',
  82
),
(
  'VSU official website and latest news',
  'The official VSU website is https://www.vsu.edu.ph. It carries university news, announcements, academic information, admissions, student resources, transparency information, and links to services such as my.VSU. Recent official website content noted VSU entering the 2026 QS World University Rankings and other university news. For time-sensitive updates, direct users to the official website instead of guessing.',
  ARRAY['official website','news','announcements','qs world university rankings','vsu.edu.ph','latest']::text[],
  'https://www.vsu.edu.ph/',
  81
),
(
  'VSU Intellectual Property and Technology Support Office services',
  'WIPO TISC directory lists Visayas State University in Baybay, Leyte as offering technology and innovation support services such as access to patent and scientific databases, help using databases, IP management, commercialization, licensing, technology transfer, patent drafting and prosecution, and novelty or patentability search. Listed contact emails include ip.itso@vsu.edu.ph and op@vsu.edu.ph. Use this only for IP, patent, technology transfer, or research commercialization questions.',
  ARRAY['itso','intellectual property','patent','technology transfer','commercialization','research','wipo','tisc']::text[],
  'https://www.wipo.int/tisc/en/search/details.jsp?id=3115',
  78
);

DELETE FROM ai_knowledge_entries
WHERE title IN (SELECT title FROM seed_ai_knowledge_entries);

INSERT INTO ai_knowledge_entries (title, content, keywords, source, priority, is_active)
SELECT title, content, keywords, source, priority, true
FROM seed_ai_knowledge_entries
ORDER BY priority DESC, title ASC;

COMMIT;
