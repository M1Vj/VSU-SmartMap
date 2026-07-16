export type HelpSection = {
  heading: string;
  body?: string;
  steps?: string[];
  tips?: string[];
};

/**
 * A single interactive spotlight step. `element` is a CSS selector of a real
 * on-screen control; steps without one render as a centered modal step. Steps
 * whose selector matches nothing are filtered out before the tour starts.
 */
export type TourStep = {
  element?: string;
  title: string;
  description: string;
};

export type HelpGuide = {
  title: string;
  audience: "student" | "owner" | "admin" | "general";
  intro: string;
  sections: HelpSection[];
  tourSteps?: TourStep[];
};

export const GENERAL_GUIDE: HelpGuide = {
  title: "Campus SmartMap for VSU — Quick guide",
  audience: "general",
  intro:
    "Campus SmartMap for VSU helps you find your way around Visayas State University. Search buildings and rooms, get walking or driving directions, browse boarding houses, check campus events, and ask the assistant questions.",
  sections: [
    {
      heading: "Move around the app",
      steps: [
        "Use the tabs (or the menu on smaller screens) to switch between the Map, Boarding Houses, Events, Directory, and Chat.",
        "Use the search box at the top to look up a building or facility by name.",
        "Open the gear (Settings) icon for theme, map style, your default travel mode, and this guide.",
      ],
    },
    {
      heading: "Need help on a specific page?",
      body:
        "This guide changes to match the page you are on. Open it from any page and it will explain exactly what you can do there.",
      tips: [
        "You can also open this guide by adding ?guide=1 to the page address — handy for sharing a how-to link.",
      ],
    },
  ],
  tourSteps: [
    {
      title: "Welcome to Campus SmartMap for VSU",
      description:
        "This guide adapts to each page. Open it anywhere to learn what you can do there.",
    },
    {
      element: 'button[aria-label="Settings"]',
      title: "Settings & help",
      description:
        "Theme, map style, your default travel mode, and this guide all live behind the gear icon.",
    },
  ],
};

const STUDENT_MAP_GUIDE: HelpGuide = {
  title: "Campus Map",
  audience: "student",
  intro:
    "The map shows every building and facility at VSU. Use it to find a place, learn about it, and get step-by-step directions.",
  sections: [
    {
      heading: "Find a place",
      steps: [
        'Type a name or code in the search box at the top — for example "DSTAT", or a room code like "ICT101".',
        "Pick a result to jump straight to it on the map.",
        "Or tap any pin on the map to see what it is.",
      ],
    },
    {
      heading: "See details about a place",
      steps: [
        "Tap a pin to open its card.",
        "Read the description, photos, and the rooms or offices inside.",
        "Tap Navigate (the directions button) to route to it.",
      ],
    },
    {
      heading: "Get directions",
      steps: [
        "Open a place and tap Navigate.",
        "Set your starting point by tapping the map where you are — this drops your start pin.",
        "Or tap the locate button at the bottom-left to use your current location instead.",
        "Follow the highlighted route on the map.",
      ],
      tips: [
        "Set your usual travel mode (walking or driving) in Settings so routes default to it.",
      ],
    },
    {
      heading: "Filter what you see",
      steps: [
        "Open the category filters and turn categories on or off (for example dorms, offices, or food) to reduce clutter.",
      ],
    },
    {
      heading: "Show boarding houses on the map",
      steps: [
        "Turn on the boarding-house overlay from the Boarding tab or the map filters.",
        "Nearby rentals appear as pins — tap one to see its price and open the listing.",
      ],
    },
    {
      heading: "Suggest a missing place",
      steps: [
        'Tap the "Submit Location" button.',
        "Fill in the name and details, then drop a pin where the place belongs.",
        "Send it. An admin reviews your suggestion before it appears for everyone.",
      ],
    },
    {
      heading: "Change how the map looks",
      body:
        "Open Settings to switch between the Vector map and the Satellite view, or to change light/dark theme.",
    },
  ],
  tourSteps: [
    {
      title: "Tour the campus map",
      description:
        "A quick walk through finding places and getting directions. Tap Next to continue.",
    },
    {
      element: '[data-tour="map-search"]',
      title: "Search",
      description:
        "Type a building name or a room code like ICT101, then pick a result to jump to it.",
    },
    {
      element: '[data-tour="map-filters"]',
      title: "Filters",
      description:
        "Show only the categories you want, and toggle the boarding-house overlay, to cut clutter.",
    },
    {
      element: ".leaflet-marker-icon",
      title: "Place pins",
      description:
        "Tap any pin to open its details, photos, and the Navigate button for directions.",
    },
    {
      element: '[data-tour="map-locate"]',
      title: "Find yourself",
      description:
        "Center the map on where you are — useful as the starting point of a route.",
    },
    {
      element: ".leaflet-control-zoom",
      title: "Zoom",
      description: "Zoom in and out to reveal building labels and nearby paths.",
    },
    {
      element: '[data-tour="map-submit"]',
      title: "Submit a location",
      description:
        "Spotted a missing place? Suggest it here and an admin will review it before it appears.",
    },
  ],
};

const STUDENT_BOARDING_GUIDE: HelpGuide = {
  title: "Boarding Houses",
  audience: "student",
  intro:
    "Browse verified boarding houses near campus, compare rent and amenities, and contact owners directly. Listings are posted by owners and reviewed by admins.",
  sections: [
    {
      heading: "Narrow down the list",
      steps: [
        "Open the filters and set your rent range and how many free slots you need.",
        "Choose a room type and gender policy if you have a preference.",
        "Tick the essentials that matter to you — for example Aircon, Private bathroom, or Water/Electricity included.",
        'Set a maximum walking time. You can change the reference point or tap "Use my location" so the walk times are measured from where you actually are.',
      ],
    },
    {
      heading: "Sort and change the view",
      steps: [
        "Use the sort menu to order results (for example by price or walking time).",
        "Switch between the comfortable and compact views to see more or fewer cards at once.",
      ],
    },
    {
      heading: "Read a listing card",
      tips: [
        "A Verified badge means an admin checked the owner's identity and their authority to rent the place — it is not a quality rating.",
        "Walking times are routed along real paths, not straight-line distance.",
        'The "Updated X ago" note tells you how fresh the price and slots are.',
      ],
    },
    {
      heading: "Open a listing's detail page",
      steps: [
        "Tap a card to see the full listing.",
        "Compare the room options — each has its own price, photos, and amenities.",
        'Check the move-in terms (for example "1 month advance + 1 month deposit").',
        "Contact the owner by call, text, or Messenger using the buttons provided.",
        "Sign in with Google to leave a review, or use the report form if something looks wrong.",
      ],
    },
    {
      heading: "Stay safe",
      tips: [
        "Never pay or send money over GCash before you have seen the room in person.",
        "If a listing looks fake or misleading, use the report form on its page — an admin will look into it.",
      ],
    },
  ],
  tourSteps: [
    {
      element: "#boarding-house-filters",
      title: "Filters",
      description:
        'Set rent, slots, room type, amenities, and walking time. Tap "Use my location" so walk times start from where you are.',
    },
    {
      element: '[aria-label="Sort boarding houses"]',
      title: "Sort",
      description:
        "Order results by nearest, price, top rated, or most recently updated.",
    },
    {
      element: '[aria-label="Listing view density"]',
      title: "View density",
      description: "Switch between comfortable cards and a compact list.",
    },
    {
      element: 'section[aria-label="Boarding house results"] a[href^="/boarding-houses/"]',
      title: "Listing cards",
      description:
        "Each card shows price, free slots, a routed walk time, and a Verified badge when the owner passed review. Tap to open the full listing.",
    },
    {
      title: "Stay safe",
      description:
        "Never pay before seeing a room in person. Use the report form on a listing if something looks wrong.",
    },
  ],
};

const STUDENT_EVENTS_GUIDE: HelpGuide = {
  title: "Campus Events",
  audience: "student",
  intro:
    "See what is happening around campus and suggest your own event for the calendar.",
  sections: [
    {
      heading: "Browse events",
      steps: [
        "Switch between the Calendar and List tabs to view events the way you prefer.",
        "Use the category filter to focus on the kinds of events you care about.",
        "Use the search box at the top to find an event by name.",
      ],
    },
    {
      heading: "Suggest an event",
      steps: [
        "Open the suggest-an-event form.",
        "Fill in the title, category, date and time, and attach proof (for example an official poster or memo).",
        "Submit it. An admin reviews the suggestion, and once approved it is published as an event.",
      ],
    },
  ],
  tourSteps: [
    {
      element: 'input[placeholder*="Search events"]',
      title: "Search events",
      description: "Find an event by name from the search box at the top.",
    },
    {
      element: '[role="tablist"]',
      title: "Calendar or list",
      description:
        "Switch between a monthly calendar and a scrollable list of events.",
    },
    {
      element: '[data-tour="events-suggest"]',
      title: "Suggest an event",
      description:
        "Propose your own event with a poster or memo as proof. An admin reviews it before it goes live.",
    },
  ],
};

const STUDENT_DIRECTORY_GUIDE: HelpGuide = {
  title: "Facility Directory",
  audience: "student",
  intro:
    "A browsable list of every facility on campus — useful when you want to scan everything instead of hunting on the map.",
  sections: [
    {
      heading: "Browse and filter",
      steps: [
        "Scroll the list of facilities.",
        "Use the category filters to show only the types you want.",
        "Use the search box at the top to find a facility by name.",
      ],
    },
    {
      heading: "Jump to the map",
      steps: [
        "Open a facility from the directory to view its details and see it on the map, where you can start directions.",
      ],
    },
  ],
  tourSteps: [
    {
      element: '[data-tour="map-search"]',
      title: "Search",
      description: "Look up any facility by name.",
    },
    {
      element: 'button[aria-label^="Filter directory categories"]',
      title: "Filter",
      description: "Narrow the list to the categories you care about.",
    },
    {
      title: "Open a facility",
      description:
        "Tap any facility to see its details and jump to it on the map.",
    },
  ],
};

const STUDENT_CHAT_GUIDE: HelpGuide = {
  title: "Ask SmartMap (Assistant)",
  audience: "student",
  intro:
    "The assistant answers questions about VSU using the app's own data. It is great for quick lookups when you are not sure where to search.",
  sections: [
    {
      heading: "What it knows",
      body:
        "The assistant can answer about campus buildings, rooms, offices, events, and boarding houses that are in SmartMap.",
    },
    {
      heading: "Example questions",
      tips: [
        '"Where is the Registrar\'s office?"',
        '"Which building has room ICT101?"',
        '"Are there boarding houses under ₱2,000 near the main gate?"',
        '"What events are happening this week?"',
      ],
    },
    {
      heading: "Good to know",
      tips: [
        "There is a daily limit of 6 messages per day, so make each question count.",
        "The assistant can make mistakes. Double-check anything important (like office hours or fees) with the official source before relying on it.",
      ],
    },
  ],
  tourSteps: [
    {
      element: "textarea",
      title: "Ask a question",
      description:
        "Type here to ask about buildings, rooms, offices, events, or boarding houses.",
    },
    {
      title: "Daily limit & accuracy",
      description:
        "You get 6 questions per day. The assistant can make mistakes — verify anything important with the official source.",
    },
  ],
};

const STUDENT_INFO_GUIDE: HelpGuide = {
  title: "About & Info",
  audience: "student",
  intro:
    "Background on the SmartMap project, the team, and how to give feedback.",
  sections: [
    {
      heading: "Give feedback",
      steps: [
        "Open Settings (the gear icon) to report a bug or a route problem.",
        'Use "Report a Bug" for anything broken, and "Report Route Issue" if directions sent you the wrong way.',
      ],
    },
  ],
};

const OWNER_DASHBOARD_GUIDE: HelpGuide = {
  title: "Owner Portal — Dashboard",
  audience: "owner",
  intro:
    "This is your home base as a boarding-house owner. From here you create listings, keep availability current, and see the status of everything you have submitted.",
  sections: [
    {
      heading: "Become a verified owner first",
      steps: [
        "Sign in with your Google account.",
        "Apply for verification: give your display name and contact details, explain your relationship to the property, and upload an identity document plus proof of authority to rent it.",
        "Wait for an admin to approve your application. You can create listings once you are approved.",
      ],
    },
    {
      heading: "Read your listing cards",
      tips: [
        "The colored badge shows each listing's status: Draft, In review, Published, Unpublished, Rejected, or Suspended.",
        "If a listing was rejected, unpublished, or suspended, the card shows the admin's reason in a colored box — read it before you resubmit.",
      ],
    },
    {
      heading: "Keep availability accurate",
      steps: [
        'Use the "Quick availability update" steppers on a card to raise or lower free slots per room.',
        "Changes save instantly — no review needed. Keeping slots current is the most important thing you can do for students.",
      ],
    },
    {
      heading: "Submit or resubmit for review",
      steps: [
        'A Draft, Rejected, or Unpublished listing shows a "Submit for review" button — use it to send the listing to an admin.',
        'Once published, use "View public page" to see exactly what students see.',
      ],
    },
  ],
  tourSteps: [
    {
      element: 'a[href="/owner/listings/new"]',
      title: "Create a listing",
      description: "Start a new draft listing here, then fill in its details.",
    },
    {
      element: '[data-tour="owner-status"]',
      title: "Listing status",
      description:
        "This badge shows whether a listing is a draft, in review, published, unpublished, rejected, or suspended. If an admin left a reason, it appears on the card.",
    },
    {
      element: '[data-tour="owner-slots"]',
      title: "Keep availability current",
      description:
        "Use the plus and minus steppers to update free slots per room. Changes save instantly — no review needed.",
    },
  ],
};

const OWNER_LISTING_GUIDE: HelpGuide = {
  title: "Owner Portal — Create or Edit a Listing",
  audience: "owner",
  intro:
    "Fill in the details students need to decide and to contact you. New listings start as a draft; you submit them for review when ready.",
  sections: [
    {
      heading: "Basics and location",
      steps: [
        "Enter the listing name and full address.",
        "Set the location: tap the map to drop the blue pin, or type the latitude and longitude.",
        "Write a short description highlighting rooms, location, and anything student-friendly.",
        "Add your contact details — phone, Facebook link, and email — so students can reach you.",
      ],
    },
    {
      heading: "Add your room offerings",
      steps: [
        'Add one row per room or bed type using "Add room".',
        "For each room, set a label, room type, monthly price, and available slots.",
        "Optionally add people per room, room size in square meters, and tick Aircon or Private bathroom.",
        "Optionally attach one photo per room.",
      ],
      tips: [
        "The listing's overall price range and total slots are calculated automatically from your room rows.",
        "You can list up to 10 rooms.",
      ],
    },
    {
      heading: "Amenities, utilities, and rules",
      steps: [
        "Tick the occupancy policies you allow.",
        "Tick house amenities and rules (Wi-Fi, cooking, furnished, laundry, parking, study area, curfew, visitors, pets).",
        "Mark whether water and electricity are included and whether a private bathroom is available.",
        "Set move-in terms — advance and deposit months (1 month advance plus 1 month deposit is common).",
        "Add a curfew time if you have one.",
      ],
    },
    {
      heading: "Add listing photos",
      steps: [
        "Add up to 8 photos of the property.",
        "The first photo is the cover students see first — use the arrows to reorder.",
      ],
      tips: [
        "Photos are compressed in your browser before uploading, so large images are fine.",
      ],
    },
    {
      heading: "Save and submit",
      steps: [
        "Save a new listing as a draft, then submit it for review from the dashboard.",
        "An admin publishes the listing once it passes review.",
      ],
    },
    {
      heading: "Which edits need review?",
      tips: [
        "On a live (published/verified) listing, changing the name, address, map pin, description, or photos sends it back to review and temporarily hides it until an admin re-approves.",
        "Changing price, slots, contacts, amenities, rules, or move-in terms applies instantly with no review.",
      ],
    },
  ],
  tourSteps: [
    {
      element: '[data-tour="owner-offerings"]',
      title: "Room offerings",
      description:
        "Add one row per room type with its price and slots. The listing's price range and total slots come from these rows.",
    },
    {
      element: '[data-tour="owner-utilities"]',
      title: "Utilities & bathroom",
      description:
        "Tell students whether water, electricity, and a private bathroom are included.",
    },
    {
      element: '[data-tour="owner-movein"]',
      title: "Move-in terms",
      description:
        "Set advance and deposit months — 1 month advance plus 1 month deposit is common.",
    },
    {
      element: '[data-tour="owner-photos"]',
      title: "Photos",
      description:
        "Add up to 8 photos. The first is the cover students see first — reorder with the arrows.",
    },
    {
      element: 'form button[type="submit"]',
      title: "Save",
      description:
        "Save a new listing as a draft, then submit it for review from your dashboard.",
    },
  ],
};

const OWNER_APPLY_GUIDE: HelpGuide = {
  title: "Owner Portal — Verification Application",
  audience: "owner",
  intro:
    "Verification confirms who you are and that you are allowed to rent the property. You must be approved before your listings can go live.",
  sections: [
    {
      heading: "What to prepare",
      steps: [
        "Your display name and a reachable phone and email.",
        "A short note explaining your relationship to the property and who handles student inquiries.",
        "An identity document (PNG, JPG, WebP, or PDF, up to 10MB).",
        "Proof of authority to rent — for example a title, lease, or authorization letter (same file rules).",
      ],
    },
    {
      heading: "Submit and wait",
      steps: [
        "Send the application.",
        "An admin reviews your documents and approves or declines. Once approved, you can create and submit listings.",
      ],
    },
  ],
  tourSteps: [
    {
      element: "#displayName",
      title: "Your details",
      description: "Enter your name and reachable contact information.",
    },
    {
      element: "#authorityNotes",
      title: "Explain your authority",
      description:
        "Describe your relationship to the property and who handles student inquiries.",
    },
    {
      element: "#identityDocument",
      title: "Upload documents",
      description:
        "Attach an identity document and proof of authority. An admin reviews these before you can list.",
    },
  ],
};

const OWNER_LOGIN_GUIDE: HelpGuide = {
  title: "Owner Portal — Sign In",
  audience: "owner",
  intro: "Owners sign in with Google to manage their listings.",
  sections: [
    {
      heading: "Sign in",
      steps: [
        "Sign in with your Google account.",
        "If you have not applied yet, you will be asked to submit a verification application first.",
      ],
    },
  ],
};

const ADMIN_OVERVIEW_GUIDE: HelpGuide = {
  title: "Admin — Getting Started",
  audience: "admin",
  intro:
    "This admin workspace controls what students see in SmartMap: the map, boarding houses, events, directions, and the assistant's knowledge. If this account was handed to your organization, read this first — your changes are live for everyone.",
  sections: [
    {
      heading: "Sign in and find your way",
      steps: [
        "Sign in at the admin login page.",
        "Open the menu button (top-left) to reveal the sidebar with every section.",
        "Use Logout (top-right) when you finish, especially on a shared computer.",
      ],
    },
    {
      heading: "What each section does",
      tips: [
        "Dashboard — a quick overview of counts, recent submissions, and upcoming events.",
        "Facilities — add and edit the buildings, offices, and rooms shown on the map.",
        "Boarding Houses — approve owners, publish listings, and handle student reports.",
        "Events — publish events and review student event suggestions.",
        "Navigation — edit the walking/driving path network that powers directions.",
        "AI Knowledge — the facts the assistant is allowed to use when answering students.",
        "Suggestions — review student-submitted facility additions and edits.",
        "Bug Reports — see problems students reported.",
      ],
    },
    {
      heading: "Golden rules before you approve or reject anything",
      tips: [
        "Verification means identity and authority only — that the owner is who they say and may rent the place. It is not a quality or safety rating.",
        "Always open and read an owner's documents before approving them.",
        "When you reject, suspend, or unpublish something, write a clear reason. Owners see your note.",
        "Publishing a listing makes it visible to students and marks it verified — only do this after review.",
        "Your edits to the map, paths, and knowledge take effect for students immediately.",
      ],
    },
  ],
  tourSteps: [
    {
      title: "Welcome, admin",
      description:
        "This workspace controls what students see. Your changes go live immediately, so review carefully.",
    },
    {
      element: 'button[aria-label="Toggle navigation menu"]',
      title: "Open the menu",
      description:
        "Open the sidebar to reach every section: Facilities, Boarding Houses, Events, Navigation, AI Knowledge, Suggestions, and Bug Reports.",
    },
    {
      element: 'a[href="/admin/boarding-houses"]',
      title: "Quick actions",
      description:
        "Shortcuts to the most frequent jobs, like reviewing boarding houses.",
    },
  ],
};

const ADMIN_FACILITIES_GUIDE: HelpGuide = {
  title: "Admin — Facilities",
  audience: "admin",
  intro:
    "Facilities are the buildings, offices, and landmarks on the map. Here you add them, edit their details, place them, and manage the rooms inside.",
  sections: [
    {
      heading: "Add a facility",
      steps: [
        'Click "Add facility".',
        "Fill in the name, category, description, and other details.",
        "Set the location by placing the coordinate pin on the map.",
        "Optionally upload a photo, then save. It appears on the map right away.",
      ],
    },
    {
      heading: "Edit or delete",
      steps: [
        "Use a facility's row actions to Edit its details or update its photo.",
        "Deleting a facility is permanent — you will be asked to confirm.",
      ],
    },
    {
      heading: "Manage rooms",
      steps: [
        'Open "Manage rooms" for a facility to add rooms with their codes and details.',
        "Room codes (like ICT101) are what students search for, so keep them accurate.",
      ],
    },
    {
      heading: "History",
      body: "Open a facility's history to see how it changed over time.",
    },
  ],
  tourSteps: [
    {
      element: "table",
      title: "Facilities",
      description:
        "Every building, office, and landmark. Use the row actions to edit, manage rooms, or delete.",
    },
    {
      title: "Add a facility",
      description:
        "Use the add button to create a facility, set its category and details, and place it on the map. It appears to students right away.",
    },
  ],
};

const ADMIN_BOARDING_GUIDE: HelpGuide = {
  title: "Admin — Boarding Houses",
  audience: "admin",
  intro:
    "The most important admin area. You verify owners, decide which listings go live, and act on student reports. Everything here is split into three tabs: Listing moderation, Owner applications, and Student report queue.",
  sections: [
    {
      heading: "Approve owner applications",
      steps: [
        'Open the "Owner applications" tab.',
        "For each applicant, open every uploaded document (identity and proof of authority) and confirm they are genuine.",
        'Click "Approve" only when identity and authority are clear.',
        "To decline, type an optional note explaining why, then click Reject.",
      ],
      tips: [
        'If an applicant shows "No documents uploaded", do not approve — ask them to resubmit with documents.',
      ],
    },
    {
      heading: "Moderate a listing",
      steps: [
        'Open the "Listing moderation" tab and click "View details" on a listing.',
        "Review the photos, price, rooms, amenities, rules, owner contacts, and map location.",
        "Use the moderation actions at the bottom of the details panel.",
      ],
    },
    {
      heading: "What each listing action means",
      tips: [
        "Publish — makes a pending, unpublished, suspended, or draft listing live and verified for students.",
        "Reject (with a reason) — declines a listing that is waiting for review. The owner sees your reason and can fix and resubmit.",
        "Unpublish — takes a live listing off the map (for example if it is outdated). The owner can resubmit it.",
        "Suspend (with a reason) — takes a live listing down for a policy problem. The owner sees your reason.",
        'Rejected listings show "Reconsider (move to unpublished)" — use it to move a rejected listing back into Unpublished so it can be reviewed and published again.',
      ],
    },
    {
      heading: "Handle student reports",
      steps: [
        'Open the "Student report queue" tab.',
        'Read the report reason and details, then click "View listing" to inspect the reported listing and act on it if needed.',
        'Add a moderator note and click "Resolve" once handled, or "Dismiss" if there is nothing to act on.',
      ],
    },
    {
      heading: "Remember",
      tips: [
        "Verification means identity and authority only — not a quality or safety guarantee.",
        "Always write clear reasons when rejecting, suspending, or unpublishing. Owners read them.",
      ],
    },
  ],
  tourSteps: [
    {
      element: '[role="tablist"]',
      title: "Three queues",
      description:
        "Listing moderation, Owner applications, and Student reports each have their own tab.",
    },
    {
      element: '[data-tour="admin-bh-listing"]',
      title: "A listing",
      description:
        'Each listing shows its status and owner. Open "View details" to review everything and act.',
    },
    {
      element: '[data-tour="admin-bh-tab-applications"]',
      title: "Owner applications",
      description:
        "Open this tab to review an owner's identity and authority documents before approving.",
    },
    {
      element: '[data-tour="admin-bh-tab-reports"]',
      title: "Student reports",
      description:
        "Open this tab to read student reports, view the listing, and resolve or dismiss them.",
    },
    {
      title: "Golden rule",
      description:
        "Verification means identity and authority only. Always write a clear reason when you reject, suspend, or unpublish — owners see it.",
    },
  ],
};

const ADMIN_EVENTS_GUIDE: HelpGuide = {
  title: "Admin — Events",
  audience: "admin",
  intro:
    "Publish campus events and review the events students suggest. Work is split across three tabs: Suggestions, Upcoming, and Archived.",
  sections: [
    {
      heading: "Review student suggestions",
      steps: [
        'Open the "Suggestions" tab (the badge shows how many are pending).',
        'Click "View" to open the proof the student attached and confirm the event is real.',
        "Approve (the green check) to publish it as an event, or Reject (the red X) to decline it.",
      ],
    },
    {
      heading: "Add an event yourself",
      steps: [
        'Click "Add event".',
        "Fill in the title, category, date and time, location, and description, then save.",
      ],
    },
    {
      heading: "Manage existing events",
      steps: [
        'Use the "Upcoming" and "Archived" tabs to review events.',
        "Edit or remove an event from its row when details change.",
      ],
    },
  ],
  tourSteps: [
    {
      element: '[role="tablist"]',
      title: "Suggestions, Upcoming, Archived",
      description:
        "Review student event suggestions and manage published events across these tabs.",
    },
    {
      title: "Add or review",
      description:
        'Use "Add event" to publish one yourself. On the Suggestions tab, View the proof, then approve (publishes it) or reject.',
    },
  ],
};

const ADMIN_NAVIGATION_GUIDE: HelpGuide = {
  title: "Admin — Navigation Editor",
  audience: "admin",
  intro:
    "This editor is the path network behind student directions. It is a graph of nodes (points) joined by edges (paths). Changes affect student routing as soon as you save, so edit carefully.",
  sections: [
    {
      heading: "The basics",
      tips: [
        "Nodes are points on the map; edges are the paths that connect them.",
        "The toolbar (top-left of the map) switches between Select, Add Node, and Add Edge modes, plus Undo, Redo, and Save.",
        "The side panel shows totals and the properties of whatever you have selected. Your work also autosaves about once a minute.",
      ],
    },
    {
      heading: "Add nodes and connect paths",
      steps: [
        "Switch to Add Node mode and click the map to drop points.",
        "Switch to Add Edge mode to chain paths: click one node then the next to connect them.",
        "Before drawing, choose whether new edges are two-way or one-way, and the type: Walkway (walking), Shared Road (walking and driving), or Car Road (driving only).",
      ],
    },
    {
      heading: "Select and edit in bulk",
      steps: [
        "In Select mode, drag a box to marquee-select many items at once; hold Shift to add to the selection.",
        "Use the box-select control at the bottom to choose whether the marquee grabs Nodes or Edges.",
        "With a selection, use the side panel to change edge type, flip direction, set a node's role, or Delete the whole selection.",
      ],
    },
    {
      heading: "Gate nodes",
      body:
        "Set a node's type to Gate to mark where campus paths connect to outside roads. Gates are how routing crosses between the campus network and external roads, so place them where people actually enter and leave.",
    },
    {
      heading: "Facility entries and closures",
      tips: [
        "Mark a node as a Facility Entry and link it to buildings so directions can end at the right door.",
        "Use closure rules to close a node or path temporarily (for construction) or on a recurring schedule (opening hours).",
      ],
    },
    {
      heading: "Save your work",
      steps: [
        "Click Save (or let autosave run) to publish your changes.",
        'Use "Refresh" to pull the latest graph from the server if you think it changed elsewhere.',
      ],
    },
  ],
  tourSteps: [
    {
      element: '[data-tour="nav-toolbar"]',
      title: "Editing tools",
      description:
        "Switch between Select, Add Node, and Add Edge, and Save. New edges can be walkway, shared road, or car road, and one-way or two-way.",
    },
    {
      element: '[data-tour="nav-panel"]',
      title: "Selection & properties",
      description:
        "Totals and the properties of your selection show here. Set a node's role, mark Facility Entry or Gate nodes, and manage closures.",
    },
    {
      title: "Gates & bulk edits",
      description:
        "Gate nodes connect campus paths to outside roads. In Select mode, drag a box to marquee-select many items; hold Shift to add. Changes affect routing as soon as you save.",
    },
  ],
};

const ADMIN_AI_KNOWLEDGE_GUIDE: HelpGuide = {
  title: "Admin — AI Knowledge",
  audience: "admin",
  intro:
    "These are the facts the assistant is allowed to use when answering students. Add verified information here so the assistant gives correct answers.",
  sections: [
    {
      heading: "Add a knowledge entry",
      steps: [
        'Click "Add Knowledge".',
        "Give it a clear title and concise, verified content (for example office procedures or schedules).",
        "Add keywords students might use so the assistant can find it.",
        'Set a priority (higher shows first when several entries match) and keep "Active in chatbot" ticked.',
        "Save.",
      ],
    },
    {
      heading: "Edit, hide, or delete",
      steps: [
        "Use an entry's menu to Edit or Delete it.",
        "Untick Active to hide an entry from the assistant without deleting it.",
      ],
      tips: [
        "Only active entries reach the assistant, and it only receives the relevant ones for each question.",
        "Keep entries short and factual — vague or outdated notes lead to wrong answers.",
      ],
    },
  ],
  tourSteps: [
    {
      element: '[data-tour="ai-add"]',
      title: "Add knowledge",
      description:
        "Add concise, verified facts the assistant can use. Keep entries active to include them.",
    },
    {
      element: "table",
      title: "Your entries",
      description:
        "Edit, hide (untick Active), or delete entries. Only active entries reach the assistant.",
    },
  ],
};

const ADMIN_SUGGESTIONS_GUIDE: HelpGuide = {
  title: "Admin — Suggestions",
  audience: "admin",
  intro:
    "Students can suggest new facilities and edits to existing ones. Review each here before it changes the map.",
  sections: [
    {
      heading: "Review a suggestion",
      steps: [
        'Click "Review" on a row to open the suggestion.',
        "The detail page shows a side-by-side diff of what would change (for a facility or a room).",
        "You can adjust the proposed details before applying them.",
      ],
    },
    {
      heading: "Approve or reject",
      steps: [
        "Approve to apply the change — a new facility or room is created, or an existing one is updated, immediately.",
        "Reject with an optional reason if the suggestion is wrong or a duplicate.",
      ],
    },
    {
      heading: "Clear the backlog quickly",
      steps: [
        'On the list, tick several suggestions and use "Reject Selected" to reject them in one step (this cannot be undone).',
      ],
    },
  ],
  tourSteps: [
    {
      element: "table",
      title: "Pending suggestions",
      description:
        "Student-submitted facility additions and edits. Click Review to open one.",
    },
    {
      title: "Approve or reject",
      description:
        "Review shows a diff of the change. Approve applies it immediately; reject with a reason. Use the checkboxes to reject several at once.",
    },
  ],
};

const ADMIN_BUGS_GUIDE: HelpGuide = {
  title: "Admin — Bug Reports",
  audience: "admin",
  intro:
    "Problems students reported through the app. Use this to triage and track fixes.",
  sections: [
    {
      heading: "Work through reports",
      steps: [
        "Reports are listed newest first, with a severity tag from Low to Critical.",
        "Click a row to see the full description, screenshot, and device info.",
        "Change a report's status (Open, In Progress, Resolved, Closed) from the status dropdown as you work on it.",
      ],
    },
    {
      heading: "Remove a report",
      steps: [
        "Use the delete (trash) button to permanently remove a report you no longer need. You will be asked to confirm.",
      ],
    },
  ],
  tourSteps: [
    {
      element: "table",
      title: "Bug reports",
      description:
        "Problems students reported, newest first, tagged by severity.",
    },
    {
      title: "Triage",
      description:
        "Click a row for full details and a screenshot. Change the status as you work, or delete a report you no longer need.",
    },
  ],
};

const ADMIN_LOGIN_GUIDE: HelpGuide = {
  title: "Admin — Sign In",
  audience: "admin",
  intro: "Sign in to reach the admin workspace.",
  sections: [
    {
      heading: "Sign in",
      steps: [
        "Enter your admin email and password.",
        "After signing in you land on the Dashboard. Open this guide again there for a tour of every section.",
      ],
    },
  ],
};

type RouteGuide = { path: string; guide: HelpGuide };

const ROUTE_GUIDES: RouteGuide[] = [
  { path: "/", guide: STUDENT_MAP_GUIDE },
  { path: "/boarding-houses", guide: STUDENT_BOARDING_GUIDE },
  { path: "/events", guide: STUDENT_EVENTS_GUIDE },
  { path: "/directory", guide: STUDENT_DIRECTORY_GUIDE },
  { path: "/chat", guide: STUDENT_CHAT_GUIDE },
  { path: "/info", guide: STUDENT_INFO_GUIDE },

  { path: "/owner", guide: OWNER_DASHBOARD_GUIDE },
  { path: "/owner/login", guide: OWNER_LOGIN_GUIDE },
  { path: "/owner/apply", guide: OWNER_APPLY_GUIDE },
  { path: "/owner/listings", guide: OWNER_LISTING_GUIDE },

  { path: "/admin", guide: ADMIN_OVERVIEW_GUIDE },
  { path: "/admin/login", guide: ADMIN_LOGIN_GUIDE },
  { path: "/admin/facilities", guide: ADMIN_FACILITIES_GUIDE },
  { path: "/admin/boarding-houses", guide: ADMIN_BOARDING_GUIDE },
  { path: "/admin/events", guide: ADMIN_EVENTS_GUIDE },
  { path: "/admin/navigation", guide: ADMIN_NAVIGATION_GUIDE },
  { path: "/admin/ai-knowledge", guide: ADMIN_AI_KNOWLEDGE_GUIDE },
  { path: "/admin/suggestions", guide: ADMIN_SUGGESTIONS_GUIDE },
  { path: "/admin/bugs", guide: ADMIN_BUGS_GUIDE },
];

function matchRouteGuide(pathname: string | null | undefined): RouteGuide | null {
  if (!pathname) return null;
  const normalized = pathname.replace(/\/+$/, "") || "/";

  let best: RouteGuide | null = null;
  for (const entry of ROUTE_GUIDES) {
    const matches =
      entry.path === "/"
        ? normalized === "/"
        : normalized === entry.path || normalized.startsWith(`${entry.path}/`);
    if (matches && (best === null || entry.path.length > best.path.length)) {
      best = entry;
    }
  }
  return best;
}

export function getGuideForPath(pathname: string | null | undefined): HelpGuide {
  return matchRouteGuide(pathname)?.guide ?? GENERAL_GUIDE;
}

/**
 * Route key for once-per-route first-visit tour nudges. Returns null when the
 * matched guide has no interactive tour, so no nudge is shown there.
 */
export function getTourRouteKey(pathname: string | null | undefined): string | null {
  const best = matchRouteGuide(pathname);
  if (!best || !best.guide.tourSteps || best.guide.tourSteps.length === 0) {
    return null;
  }
  return best.path;
}
