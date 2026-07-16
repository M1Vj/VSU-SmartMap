import type { RoomRow, RoomRowWithFacility } from "@/lib/supabase/queries/rooms";
import { db, type CacheMetaEntry } from "@/lib/db";

const ROOMS_META_KEY = "rooms" as const;

export async function getRoomsCacheMeta(): Promise<CacheMetaEntry | null> {
  if (typeof window === "undefined") return null;

  try {
    return (await db.cache_meta.get(ROOMS_META_KEY)) ?? null;
  } catch (error) {
    console.warn("Failed to get rooms cache meta from IDB:", error);
    return null;
  }
}

export async function isRoomsCacheStale(maxAgeMs: number): Promise<boolean> {
  if (typeof window === "undefined") return true;

  const meta = await getRoomsCacheMeta();
  if (!meta) return true;

  return Date.now() - meta.updatedAt > maxAgeMs;
}

export async function getCachedRooms(): Promise<(RoomRow | RoomRowWithFacility)[] | null> {
  if (typeof window === "undefined") return null;

  try {
    const rooms = await db.rooms.toArray();
    if (rooms.length === 0) return null;
    return rooms;
  } catch (error) {
    console.warn("Failed to get rooms from IDB:", error);
    return null;
  }
}

export async function setCachedRooms(rooms: (RoomRow | RoomRowWithFacility)[]): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    // We need to flatten or normalize 'RoomRowWithFacility' to match our simple DB schema
    // or just store the raw object if we change the schema.
    // The 'db.rooms' table is defined with specific indices. Dexie allow storing arbitrary extra fields.
    // Let's ensure 'facility_id' is present for indexing.

    const processedRooms: RoomRowWithFacility[] = rooms.map((room) => {
      const facility = "facility" in room ? room.facility ?? null : null;
      const facilityId = facility?.id ?? room.facility_id;

      return {
        ...room,
        facility,
        facility_id: facilityId,
      } as RoomRowWithFacility;
    });

    await db.transaction("rw", db.rooms, db.cache_meta, async () => {
      await db.rooms.clear();
      await db.rooms.bulkAdd(processedRooms);
      await db.cache_meta.put({ key: ROOMS_META_KEY, updatedAt: Date.now() });
    });
  } catch (error) {
    console.warn("Failed to cache rooms to IDB:", error);
  }
}

export async function clearCachedRooms(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    await db.transaction("rw", db.rooms, db.cache_meta, async () => {
      await db.rooms.clear();
      await db.cache_meta.delete(ROOMS_META_KEY);
    });
  } catch (error) {
    console.error("Failed to clear rooms cache:", error);
  }
}
