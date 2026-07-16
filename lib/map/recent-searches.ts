export type RecentSearch = {
  id: string;
  name: string;
};

type RecentSearchStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const RECENT_SEARCHES_KEY = "vsu-recent-searches";
export const MAX_RECENT_SEARCHES = 5;

export function readRecentSearches(storage?: RecentSearchStorage | null): RecentSearch[] {
  if (!storage) return [];

  try {
    const parsed = JSON.parse(storage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecentSearch =>
        typeof item?.id === "string" && typeof item?.name === "string"
      )
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function writeRecentSearches(
  storage: RecentSearchStorage | null | undefined,
  searches: RecentSearch[],
) {
  if (!storage) return;
  storage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify(searches.slice(0, MAX_RECENT_SEARCHES)),
  );
}

export function pushRecentSearch(
  storage: RecentSearchStorage | null | undefined,
  search: RecentSearch,
  currentSearches = readRecentSearches(storage),
) {
  const next = [
    search,
    ...currentSearches.filter((recent) => recent.id !== search.id),
  ].slice(0, MAX_RECENT_SEARCHES);

  writeRecentSearches(storage, next);
  return next;
}

export function clearRecentSearches(storage?: RecentSearchStorage | null) {
  storage?.removeItem(RECENT_SEARCHES_KEY);
}
