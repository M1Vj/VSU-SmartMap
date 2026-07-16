import type { Facility } from "@/lib/types/facility";

export type RoomSearchSource = {
  facility_id?: string | null;
  facilityId?: string | null;
  facility?: { id?: string | null } | null;
  room_code?: string | null;
  roomCode?: string | null;
  name?: string | null;
};

export type SearchSuggestionMatchType = "code" | "name" | "alias" | "room";

export type FacilitySearchSuggestion = {
  facility: Facility;
  matchType: SearchSuggestionMatchType;
  matchedRoomCode?: string;
};

type SearchSuggestionInput = {
  facilities: readonly Facility[];
  query: string;
  rooms?: readonly RoomSearchSource[];
  limit?: number;
};

type ScoredSuggestion = FacilitySearchSuggestion & {
  score: number;
  index: number;
};

const DEFAULT_LIMIT = 8;

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function getRoomFacilityId(room: RoomSearchSource) {
  return room.facility?.id ?? room.facility_id ?? room.facilityId ?? null;
}

function getRoomCode(room: RoomSearchSource) {
  return room.room_code ?? room.roomCode ?? null;
}

function roomMatchesTerm(room: RoomSearchSource, term: string) {
  const roomCode = normalize(getRoomCode(room));
  const roomName = normalize(room.name);
  return roomCode.includes(term) || roomName.includes(term);
}

export function getRoomMatchedFacilityIds(
  rooms: readonly RoomSearchSource[],
  query: string,
) {
  const term = normalize(query);
  const ids = new Set<string>();

  if (term.length === 0) return ids;

  for (const room of rooms) {
    const facilityId = getRoomFacilityId(room);
    if (!facilityId || !roomMatchesTerm(room, term)) continue;
    ids.add(facilityId);
  }

  return ids;
}

export function getSearchSuggestions({
  facilities,
  query,
  rooms = [],
  limit = DEFAULT_LIMIT,
}: SearchSuggestionInput): FacilitySearchSuggestion[] {
  const term = normalize(query);
  if (term.length === 0) return [];

  const roomMatches = new Map<string, string | undefined>();
  for (const room of rooms) {
    const facilityId = getRoomFacilityId(room);
    if (!facilityId || !roomMatchesTerm(room, term) || roomMatches.has(facilityId)) continue;
    roomMatches.set(facilityId, getRoomCode(room) ?? undefined);
  }

  const suggestions: ScoredSuggestion[] = [];

  facilities.forEach((facility, index) => {
    const name = normalize(facility.name);
    const code = normalize(facility.code);
    const description = normalize(facility.description);
    const roomCode = roomMatches.get(facility.id);

    let matchType: SearchSuggestionMatchType | null = null;
    let score = 0;

    if (code && code === term) {
      matchType = "code";
      score = 100;
    } else if (code && code.startsWith(term)) {
      matchType = "code";
      score = 90;
    } else if (code && code.includes(term)) {
      matchType = "code";
      score = 80;
    } else if (name.startsWith(term)) {
      matchType = "name";
      score = 70;
    } else if (name.includes(term)) {
      matchType = "name";
      score = 60;
    } else if (description.includes(term)) {
      matchType = "alias";
      score = 55;
    } else if (roomMatches.has(facility.id)) {
      matchType = "room";
      score = 50;
    }

    if (!matchType) return;

    suggestions.push({
      facility,
      matchType,
      matchedRoomCode: matchType === "room" ? roomCode : undefined,
      score,
      index,
    });
  });

  return suggestions
    .sort((a, b) => b.score - a.score || a.facility.name.localeCompare(b.facility.name) || a.index - b.index)
    .slice(0, limit)
    .map(({ score: _score, index: _index, ...suggestion }) => suggestion);
}
