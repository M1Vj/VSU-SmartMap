import type {
  BoardingHouseOccupancyPolicy,
  BoardingHouseRoomType,
} from "./types";
import { formatDistance } from "./distance";
import type { WalkEstimate } from "./route-distance";

export const ROOM_TYPE_LABELS: Record<BoardingHouseRoomType, string> = {
  bedspace: "Bedspace",
  shared_room: "Shared room",
  private_room: "Private room",
  studio: "Studio",
  whole_unit: "Whole unit",
};

export const OCCUPANCY_POLICY_LABELS: Record<BoardingHouseOccupancyPolicy, string> = {
  any_gender: "Any gender",
  female_only: "Female only",
  male_only: "Male only",
  family_only: "Family only",
};

export function roomTypeLabel(value: string): string {
  return ROOM_TYPE_LABELS[value as BoardingHouseRoomType] ?? value;
}

export function occupancyPolicyLabel(value: string): string {
  return OCCUPANCY_POLICY_LABELS[value as BoardingHouseOccupancyPolicy] ?? value;
}

export function formatSlotCount(count: number): string {
  return `${count} ${count === 1 ? "slot" : "slots"}`;
}

export function formatAvailabilityLabel(availableSlots: number | null): string {
  if (availableSlots === null) return "Slots on request";
  if (availableSlots === 0) return "Fully booked";
  return formatSlotCount(availableSlots);
}

export function formatSlotsListedLabel(availableSlots: number | null): string {
  return `${formatSlotCount(availableSlots ?? 0)} listed`;
}

export function formatWalkEstimateLabel(
  walk: WalkEstimate,
  referenceLabel: string,
): string {
  if (walk.approximate) {
    return `~${formatDistance(walk.meters)} · ~${walk.minutes} min to ${referenceLabel} (approx)`;
  }

  return `${formatDistance(walk.meters)} · ${walk.minutes} min walk to ${referenceLabel}`;
}
