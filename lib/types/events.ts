import type { AuditFields } from "./common";

export const EVENT_CATEGORIES = [
  "academic",
  "sports",
  "cultural",
  "religious",
  "other",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const SUGGESTION_STATUSES = ["pending", "approved", "rejected"] as const;

export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export interface Event extends AuditFields {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly startTime: string;
  readonly endTime: string;
  readonly locationText: string | null;
  readonly locationId: string | null;
  readonly category: EventCategory;
  readonly imageUrl: string | null;
}

export interface EventInsert {
  readonly id?: string;
  readonly title: string;
  readonly description?: string | null;
  readonly startTime: string;
  readonly endTime: string;
  readonly locationText?: string | null;
  readonly locationId?: string | null;
  readonly category: EventCategory;
  readonly imageUrl?: string | null;
}

export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location_text: string | null;
  location_id: string | null;
  category: EventCategory;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventSuggestion {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly startTime: string;
  readonly endTime: string;
  readonly locationText: string | null;
  readonly category: EventCategory;
  readonly proofAvailable: boolean;
  readonly status: SuggestionStatus;
  readonly submittedBy: string | null;
  readonly createdAt: string;
}

export interface EventSuggestionInsert {
  readonly id?: string;
  readonly title: string;
  readonly description?: string | null;
  readonly startTime: string;
  readonly endTime: string;
  readonly locationText?: string | null;
  readonly category: EventCategory;
  readonly proofObjectPath: string;
  readonly submittedBy?: string | null;
}

export interface EventSuggestionRow {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location_text: string | null;
  category: EventCategory;
  proof_file_url: string | null;
  proof_object_path: string | null;
  decided_at: string | null;
  proof_retain_until: string | null;
  proof_deleted_at: string | null;
  status: SuggestionStatus;
  submitted_by: string | null;
  created_at: string;
}

export interface EventFilters {
  category?: EventCategory | EventCategory[];
  startDate?: Date;
  endDate?: Date;
  query?: string;
  timeframe?: "upcoming" | "past" | "all";
}
