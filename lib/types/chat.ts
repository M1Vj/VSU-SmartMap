import type { Facility } from "./facility";

export type MessageRole = "user" | "assistant";

export interface FacilityMatch {
  facility: Facility;
  matchReason: string;
  confidence: number;
}

export interface EventMatch {
  eventId: string;
  title: string;
  startTime: string;
  endTime: string;
  locationText?: string;
  category: string;
}

export interface BoardingHouseMatch {
  listingId: string;
  name: string;
  slug: string;
  priceMin: number | null;
  priceMax: number | null;
  availableSlots: number | null;
  walkingMinutesToCampusGate: number | null;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  facilities?: FacilityMatch[];
  events?: EventMatch[];
  boardingHouses?: BoardingHouseMatch[];
  followUp?: string | null;
  isError?: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}
