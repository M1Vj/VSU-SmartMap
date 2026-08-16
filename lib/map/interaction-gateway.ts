export type MarkerActivation = {
  type: "marker";
  itemId: string;
  activationId: string;
  modality: "mouse" | "touch" | "pen" | "keyboard";
};

export type BackgroundGesture = {
  type: "background";
  target: "background" | "marker" | "control";
  activationId?: string;
  point?: { lat: number; lng: number };
};

export type InteractionEvent = MarkerActivation | BackgroundGesture;

export function createInteractionGateway(options: {
  onMarkerActivate: (itemId: string) => void;
  onBackground?: (point?: { lat: number; lng: number }) => void;
}) {
  const seenActivationIds = new Set<string>();
  const remember = (id: string) => {
    seenActivationIds.add(id);
    if (seenActivationIds.size > 128) {
      const oldest = seenActivationIds.values().next().value;
      if (oldest) seenActivationIds.delete(oldest);
    }
  };

  const dispatch = (event: InteractionEvent) => {
    if (event.type === "marker") {
      if (seenActivationIds.has(event.activationId)) return;
      remember(event.activationId);
      options.onMarkerActivate(event.itemId);
      return;
    }

    if (event.target !== "background" || (event.activationId && seenActivationIds.has(event.activationId))) {
      return;
    }
    if (event.activationId) remember(event.activationId);
    options.onBackground?.(event.point);
  };

  return {
    dispatch,
  };
}
