export function shouldFinalizePartialStream(content: string): boolean {
  return content.trim().length > 0;
}

type PartialStreamFinalPayload = {
  content: string;
  facilities?: unknown[];
  events?: unknown[];
  boardingHouses?: unknown[];
};

export function buildPartialStreamFinalPayload(
  fallbackContent: string,
  recoveredPayload?: PartialStreamFinalPayload | null
) {
  return {
    type: "final",
    content: recoveredPayload?.content || fallbackContent,
    facilities: recoveredPayload?.facilities,
    events: recoveredPayload?.events,
    boardingHouses: recoveredPayload?.boardingHouses,
  };
}
