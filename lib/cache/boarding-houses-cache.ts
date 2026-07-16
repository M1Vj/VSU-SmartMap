import type { BoardingHouseSummary } from "@/lib/boarding-houses/types";
import { db } from "@/lib/db";

const BOARDING_HOUSES_META_KEY = "boarding_houses" as const;
const DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function getCachedBoardingHouses(): Promise<BoardingHouseSummary[] | null> {
  if (typeof window === "undefined") return null;

  try {
    const listings = await db.boarding_houses.toArray();
    if (listings.length === 0) return null;
    return listings;
  } catch (error) {
    console.warn("Failed to get boarding houses from IDB:", error);
    return null;
  }
}

export async function isBoardingHousesCacheStale(
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): Promise<boolean> {
  if (typeof window === "undefined") return true;

  try {
    const meta = await db.cache_meta.get(BOARDING_HOUSES_META_KEY);
    if (!meta) return true;
    return Date.now() - meta.updatedAt > maxAgeMs;
  } catch (error) {
    console.warn("Failed to read boarding houses cache meta from IDB:", error);
    return true;
  }
}

export async function setCachedBoardingHouses(
  listings: BoardingHouseSummary[],
): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    await db.transaction("rw", db.boarding_houses, db.cache_meta, async () => {
      await db.boarding_houses.clear();
      await db.boarding_houses.bulkPut(listings);
      await db.cache_meta.put({ key: BOARDING_HOUSES_META_KEY, updatedAt: Date.now() });
    });
  } catch (error) {
    console.warn("Failed to cache boarding houses to IDB:", error);
  }
}
