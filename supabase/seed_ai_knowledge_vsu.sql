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
  'Campus SmartMap is an unofficial student-led project created by Vj F. Mabansag. It covers the Visayas State University Main Campus in Visca, Baybay City, Leyte. The app helps users find campus locations and selected events and listings; it is not an official university service.',
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
  'Map cards use exact retrieved facility identifiers and names. A room card is tied to the retrieved parent building only when the room is present in its room list. A similar name or building-code match is not proof of a room location. Use SmartMap records for app pins and its Map and Directions for navigation. The official About VSU page confirms campus identity, not map pins or routes.',
  ARRAY['location search','facility matching','rooms','building codes','cr','canteen','gym','clinic','admin']::text[],
  'https://www.vsu.edu.ph/about',
  96
),
(
  'VSU SmartMap room code and subject code guidance',
  'A room code is mapped only if it explicitly appears in the retrieved rooms for a verified building. An unrecognized code does not establish a building. Subject codes identify classes; the official Room Assignment in the schedule or Certificate of Registration identifies the venue. Private schedules belong in the official student portal or with the instructor.',
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
  'SmartMap can offer route options from a verified map destination through its Directions control. A manual start can be used when available. Chat does not compute a live route, walking time, or accessibility status. Use SmartMap Map and Directions to navigate and the official About VSU page to verify the Baybay Main Campus identity.',
  ARRAY['directions','route','pathfinding','gps','manual start pin','navigation','map tab','eta']::text[],
  'https://www.vsu.edu.ph/about',
  94
),
(
  'VSU SmartMap emergency and security guidance',
  'For an urgent safety or medical issue, use on-site security or local emergency services directly. A map listing does not establish current staffing, emergency availability, opening hours, or access. Published VSU campus-access rules can require visitor identification; verify current entry instructions with VSU and do not share identity documents in chat.',
  ARRAY['emergency','security','guard','guard house','infirmary','medical','safety','help']::text[],
  'https://www.vsu.edu.ph/university-policies-2?start=12',
  93
),
(
  'Visayas State University overview and main contact',
  'The main campus of Visayas State University is in Visca, Baybay City, Leyte 6521, Philippines. The university website lists +63 (53) 565 0600 as a general trunkline, not an emergency number. For current office contacts or visitor access, check the official VSU site. Source reviewed 2026-11-27.',
  ARRAY['vsu','visayas state university','contact','address','baybay','leyte','trunkline','uimpa']::text[],
  'https://www.vsu.edu.ph/',
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
  'The VSU Main Campus is in Baybay City, Leyte. Historic campus descriptions include land-area and building counts, but are not a current facility or room inventory. Use retrieved SmartMap records for app locations and SmartMap Map and Directions for navigation. The official About VSU page confirms Main Campus identity. Source reviewed 2026-11-27.',
  ARRAY['campus facilities','main campus','land area','camotes sea','mt pangasugan','buildings','dormitories','library','infirmary']::text[],
  'https://www.vsu.edu.ph/about',
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
  'VSU publishes admissions and program information by campus and intake. Confirm the academic year, eligibility, and availability with the current official admissions page and admission portal; prior program lists are not a guarantee of current offerings. Source reviewed 2026-11-27.',
  ARRAY['undergraduate programs','main campus','bs agriculture','bs computer science','engineering','nursing','veterinary medicine','education']::text[],
  'https://cat.vsu.edu.ph/',
  88
),
(
  'VSU component campus undergraduate programs',
  'Alangalang, Isabel, Tolosa, and Villaba are separate VSU campuses; the Baybay SmartMap does not provide directions to their buildings. Confirm a program by campus and academic year through the official admissions portal. Source reviewed 2026-11-27.',
  ARRAY['component campuses','alangalang','isabel','villaba','tolosa','undergraduate programs']::text[],
  'https://cat.vsu.edu.ph/',
  87
),
(
  'VSU College Admission Test basics',
  'The official VSU admissions portal publishes current applicant instructions for the VSU College Admission Test. Dates, eligibility, ratings, quotas, and documentary requirements depend on the published admission cycle. Check the campus and intake in the official portal; do not rely on an undated rule or estimate admission. Source reviewed 2026-11-27.',
  ARRAY['vsucat','admission','college admission test','gpa','quota','equity target group','applicants']::text[],
  'https://cat.vsu.edu.ph/',
  86
),
(
  'VSU enrollment process for incoming students',
  'VSU posts enrollment instructions through official announcements and admission channels. Check the current academic year, intake, and campus before relying on an appointment process, dates, requirements, or fees. Use the official portal or campus office for personal enrollment. Source reviewed 2026-11-27.',
  ARRAY['enrollment','enroll at vsu','incoming students','appointment','admissions office','requirements','guidance counselor']::text[],
  'https://www.vsu.edu.ph/articles/bulletin',
  86
),
(
  'VSU Office of the University Registrar contact',
  'The Office of the University Registrar handles academic records and related credentials. Use the official Registrar guidance and VSU document-request portal at https://docrequest.vsu.edu.ph/ for authorized services. Confirm the correct office/campus through VSU before visiting; do not share grades, student IDs, credentials, payment data, or documents in chat. Source reviewed 2026-11-27.',
  ARRAY['registrar','office of the university registrar','records','registration','credentials','enrollment','raymund igcasama']::text[],
  'https://www.vsu.edu.ph/vsu/987-registrar-concerns',
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
  'The VSU Learning Commons website provides information on library services and posted schedules. Some official materials differ on Saturday hours; do not use an undated schedule to say the library is open now. Check the current term notice or official contact page at https://library.vsu.edu.ph/about-us/contact-us before visiting. Source reviewed 2026-11-27.',
  ARRAY['library','learning commons','library hours','books','journals','study area','computer lab','research']::text[],
  'https://library.vsu.edu.ph/',
  84
),
(
  'VSU portals: my.VSU and e-learning',
  'The VSU site links my.VSU at https://my.vsu.edu.ph/ for a student’s grades, subjects, and personal schedule. Verify a room assignment in that portal or with the instructor. Do not share login credentials, identifying details, grades, or a private schedule in the map chat. Source reviewed 2026-11-27.',
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
  'The official VSU website publishes university news, announcements and links to campus services. For current closures, events, dates or deadlines, check the latest dated notice and the specific campus, not an older search result. Source reviewed 2026-11-27.',
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

-- Seed missing titles only. Existing entries can be edited by an administrator.
INSERT INTO public.ai_knowledge_entries (title, content, keywords, source, priority, is_active)
SELECT candidate.title, candidate.content, candidate.keywords, candidate.source, candidate.priority, true
FROM seed_ai_knowledge_entries AS candidate
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_knowledge_entries AS existing WHERE existing.title = candidate.title
)
ORDER BY candidate.priority DESC, candidate.title ASC;

COMMIT;
