export const STUDENT_DESTINATIONS = [
  { id: "map", label: "Map", route: "/", defaultVisible: true, required: true },
  { id: "schedule", label: "Schedule", route: "/schedule", defaultVisible: true, required: false },
  { id: "boarding", label: "Boarding", route: "/boarding-houses", defaultVisible: false, required: false },
  { id: "events", label: "Events", route: "/events", defaultVisible: false, required: false },
  { id: "directory", label: "Directory", route: "/directory", defaultVisible: true, required: false },
  { id: "chat", label: "Chat", route: "/chat", defaultVisible: true, required: false },
] as const;

export type StudentDestinationId = (typeof STUDENT_DESTINATIONS)[number]["id"];

export const STUDENT_NAVIGATION_STORAGE_KEY = "student-navigation-visible-v1";

export const DEFAULT_VISIBLE_STUDENT_DESTINATIONS: StudentDestinationId[] =
  STUDENT_DESTINATIONS.filter((destination) => destination.defaultVisible).map(
    (destination) => destination.id,
  );

export function normalizeVisibleStudentDestinations(
  destinations: readonly unknown[],
): StudentDestinationId[] {
  const requested = new Set(destinations);
  return STUDENT_DESTINATIONS.filter(
    (destination) => destination.required || requested.has(destination.id),
  ).map((destination) => destination.id);
}

export function resetVisibleStudentDestinations(): StudentDestinationId[] {
  return [...DEFAULT_VISIBLE_STUDENT_DESTINATIONS];
}

export function toggleVisibleStudentDestination(
  current: readonly StudentDestinationId[],
  destination: StudentDestinationId,
): StudentDestinationId[] {
  if (destination === "map") return normalizeVisibleStudentDestinations(current);
  const next = current.includes(destination)
    ? current.filter((id) => id !== destination)
    : [...current, destination];
  return normalizeVisibleStudentDestinations(next);
}

export function parseVisibleStudentDestinations(
  serialized: string | null,
): StudentDestinationId[] {
  if (serialized === null) return resetVisibleStudentDestinations();
  try {
    const parsed: unknown = JSON.parse(serialized);
    return Array.isArray(parsed)
      ? normalizeVisibleStudentDestinations(parsed)
      : resetVisibleStudentDestinations();
  } catch {
    return resetVisibleStudentDestinations();
  }
}

export function serializeVisibleStudentDestinations(
  destinations: readonly unknown[],
): string {
  return JSON.stringify(normalizeVisibleStudentDestinations(destinations));
}

type StudentNavigationStorage = Pick<Storage, "getItem" | "setItem">;

export function readVisibleStudentDestinations(
  storage: StudentNavigationStorage,
): StudentDestinationId[] {
  try {
    return parseVisibleStudentDestinations(storage.getItem(STUDENT_NAVIGATION_STORAGE_KEY));
  } catch {
    // Preferences are best-effort when browser storage is unavailable.
    return resetVisibleStudentDestinations();
  }
}

export function writeVisibleStudentDestinations(
  storage: StudentNavigationStorage,
  destinations: readonly unknown[],
): void {
  try {
    storage.setItem(
      STUDENT_NAVIGATION_STORAGE_KEY,
      serializeVisibleStudentDestinations(destinations),
    );
  } catch {
    // Preferences are best-effort when browser storage is unavailable.
  }
}

export function readVisibleStudentDestinationsFromProvider(
  getStorage: () => StudentNavigationStorage,
): StudentDestinationId[] {
  try {
    return readVisibleStudentDestinations(getStorage());
  } catch {
    // Accessing the browser's localStorage property can itself be blocked.
    return resetVisibleStudentDestinations();
  }
}

export function writeVisibleStudentDestinationsFromProvider(
  getStorage: () => StudentNavigationStorage,
  destinations: readonly unknown[],
): void {
  try {
    writeVisibleStudentDestinations(getStorage(), destinations);
  } catch {
    // Accessing the browser's localStorage property can itself be blocked.
  }
}

export function studentDestinationForPath(pathname: string): StudentDestinationId {
  const destination = STUDENT_DESTINATIONS.find(({ route }) =>
    route === "/" ? pathname === route : pathname === route || pathname.startsWith(`${route}/`),
  );
  return destination?.id ?? "map";
}

export function studentDestinationRoute(destinationId: StudentDestinationId): string {
  return STUDENT_DESTINATIONS.find(({ id }) => id === destinationId)?.route ?? "/";
}

export function shouldShowStudentNavigation(pathname: string): boolean {
  return STUDENT_DESTINATIONS.some(({ route }) =>
    route === "/"
      ? pathname === route
      : pathname === route || pathname.startsWith(`${route}/`),
  );
}
