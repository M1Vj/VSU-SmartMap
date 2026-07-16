import type { AuditFields } from "./common";

export interface Room extends AuditFields {
  readonly id: string;
  readonly facilityId: string;
  readonly roomCode: string;
  readonly name?: string;
  readonly description?: string;
  readonly floor?: number;
  readonly imageUrl?: string;
  readonly imageCredit?: string;
}

export type RoomSummary = Pick<Room, "id" | "roomCode" | "name" | "facilityId">;

