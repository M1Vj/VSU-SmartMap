import Dexie, { type Table } from "dexie";
import type { RoomRowWithFacility } from "@/lib/supabase/queries/rooms";
import type { Facility } from "@/lib/types";
import type { MapNode, MapEdge } from "@/lib/types/graph";
import type { BoardingHouseSummary } from "@/lib/boarding-houses/types";
import type { ScheduleCourse } from "@/lib/schedule/types";
import {
  GUEST_SCHEDULE_SCOPE,
} from "@/lib/schedule/scope";
import {
  scopedCourseKey,
  type ScheduleOutboxMutation,
  type ScheduleSyncState,
  type StoredScheduleConflict,
  type StoredScopedScheduleCourse,
} from "@/lib/schedule/local-types";
import { parseStoredScheduleCourse } from "@/lib/schedule/validation";

export type CacheMetaKey = "facilities" | "rooms" | "navigation" | "boarding_houses";

export interface CacheMetaEntry {
  key: CacheMetaKey;
  updatedAt: number;
}

export interface OfflineAction {
  id?: number;
  action: string;
  payload: unknown;
  timestamp: number;
}

export class VSUDatabase extends Dexie {
  rooms!: Table<RoomRowWithFacility, string>;
  facilities!: Table<Facility, string>;
  boarding_houses!: Table<BoardingHouseSummary, string>;
  map_nodes!: Table<MapNode, string>;
  map_edges!: Table<MapEdge, string>;
  offline_queue!: Table<OfflineAction, number>;
  cache_meta!: Table<CacheMetaEntry, CacheMetaKey>;
  schedule_courses!: Table<ScheduleCourse, string>;
  schedule_scoped_courses!: Table<StoredScopedScheduleCourse, string>;
  schedule_outbox!: Table<ScheduleOutboxMutation, number>;
  schedule_sync_state!: Table<ScheduleSyncState, string>;
  schedule_conflicts!: Table<StoredScheduleConflict, string>;

  constructor() {
    super("VSUSmartMapDB");
    this.version(1).stores({
      rooms: "++id, id, name, room_code, facility_id",
      facilities: "++id, id, name",
      offline_queue: "++id, action, timestamp",
    });

    // Version 2: Drop tables that need primary key changes
    this.version(2).stores({
      rooms: null,
      facilities: null,
      cache_meta: "key",
    });

    // Version 3: Recreate tables with new schema
    this.version(3).stores({
      facilities: "id, name, category",
      rooms: "id, facility_id, room_code, name",
    });

    this.version(4).stores({
      map_nodes: "id, type",
      map_edges: "id, source_id, target_id",
    });

    this.version(5).stores({
      map_edges: "id, source_id, target_id, type", 
    }).upgrade(tx => {
       return tx.table("map_edges").toCollection().modify(edge => {
          if (!edge.type) edge.type = 'walkway';
          if (!edge.access) edge.access = ['walking'];
       });
    });

    this.version(6).stores({
      map_edges: "id, source_id, target_id, type, is_closed",
    }).upgrade(tx => {
       return tx.table("map_edges").toCollection().modify(edge => {
          if (edge.bidirectional === undefined) edge.bidirectional = true;
       });
    });

    this.version(7).stores({
      map_edges: "id, source_id, target_id, type, is_closed", 
      // Dexie doesn't strict schema for non-indexed fields, but version bump is good practice
    });

    this.version(8).stores({
      map_nodes: "id, type",
    }).upgrade(tx => {
       return tx.table("map_nodes").toCollection().modify(node => {
          if (node.building_id) {
              node.building_ids = [node.building_id];
              delete node.building_id;
          }
       });
    });

    this.version(9).stores({
      boarding_houses: "id, name, slug",
    });

    this.version(10).stores({
      schedule_courses: "id, code, updatedAt",
    });

    this.version(11).stores({
      schedule_courses: "",
      schedule_scoped_courses: "&key, scope, id, course.updatedAt",
      schedule_outbox: "++sequence, &[scope+courseId], scope, mutationId, createdAt",
      schedule_sync_state: "&scope",
      schedule_conflicts: "&key, scope, courseId",
    }).upgrade(async (tx) => {
      const legacy = await tx.table("schedule_courses").toArray();
      const migrated = legacy.map((value) => {
        const course = parseStoredScheduleCourse(value);
        return {
          key: scopedCourseKey(GUEST_SCHEDULE_SCOPE, course.id),
          scope: GUEST_SCHEDULE_SCOPE,
          id: course.id,
          course,
        };
      });
      await tx.table("schedule_scoped_courses").bulkPut(migrated);
      await tx.table("schedule_courses").clear();
    });
  }
}

export const db: VSUDatabase =
  typeof window === "undefined" ? (null as unknown as VSUDatabase) : new VSUDatabase();
