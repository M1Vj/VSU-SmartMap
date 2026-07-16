import type { AuditFields } from "./common";

export const SUGGESTION_TYPES = [
  "ADD_FACILITY",
  "EDIT_FACILITY",
  "ADD_ROOM",
  "EDIT_ROOM"
] as const;

export type SuggestionType = (typeof SUGGESTION_TYPES)[number];

export const SUGGESTION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export interface Suggestion extends AuditFields {
  readonly id: string;
  readonly type: SuggestionType;
  readonly status: SuggestionStatus;
  readonly targetId: string | null;
  readonly payload: Record<string, unknown>;
  readonly adminNote: string | null;
}

export interface SuggestionInsert {
  readonly id?: string;
  readonly type: SuggestionType;
  readonly targetId: string | null;
  readonly payload: Record<string, unknown>;
  readonly status?: SuggestionStatus;
  readonly adminNote?: string | null;
}

export interface SuggestionUpdate {
  readonly status?: SuggestionStatus;
  readonly targetId?: string | null;
  readonly adminNote?: string | null;
  readonly payload?: Record<string, unknown>;
}

export interface SuggestionRow {
  id: string;
  type: SuggestionType;
  status: SuggestionStatus;
  target_id: string | null;
  payload: Record<string, unknown>;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}
