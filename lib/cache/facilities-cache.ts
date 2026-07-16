import type { Facility, FacilityLite } from "@/lib/types";
import { db, type CacheMetaEntry } from "@/lib/db";

const FACILITIES_META_KEY = "facilities" as const;

export async function getFacilitiesCacheMeta(): Promise<CacheMetaEntry | null> {
  if (typeof window === "undefined") return null;

  try {
    return (await db.cache_meta.get(FACILITIES_META_KEY)) ?? null;
  } catch (error) {
    console.warn("Failed to get facilities cache meta from IDB:", error);
    return null;
  }
}

export async function isFacilitiesCacheStale(maxAgeMs: number): Promise<boolean> {
  if (typeof window === "undefined") return true;

  const meta = await getFacilitiesCacheMeta();
  if (!meta) return true;

  return Date.now() - meta.updatedAt > maxAgeMs;
}

export async function getCachedFacilities(): Promise<Facility[] | null> {
  if (typeof window === "undefined") return null;

  try {
    const facilities = await db.facilities.toArray();
    if (facilities.length === 0) return null;
    return facilities;
  } catch (error) {
    console.warn("Failed to get facilities from IDB:", error);
    return null;
  }
}

export async function setCachedFacilities(facilities: Facility[] | FacilityLite[]): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    await db.transaction("rw", db.facilities, db.cache_meta, async () => {
      await db.facilities.clear();
      // Cast to Facility because IDB doesn't enforce strict shape beyond keys
      await db.facilities.bulkAdd(facilities as Facility[]);
      await db.cache_meta.put({ key: FACILITIES_META_KEY, updatedAt: Date.now() });
    });
  } catch (error) {
    console.warn("Failed to cache facilities to IDB:", error);
  }
}

export async function clearCachedFacilities(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    await db.transaction("rw", db.facilities, db.cache_meta, async () => {
      await db.facilities.clear();
      await db.cache_meta.delete(FACILITIES_META_KEY);
    });
  } catch (error) {
    console.error("Failed to clear facilities cache:", error);
  }
}
