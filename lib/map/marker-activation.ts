export type MarkerActivation = {
  lat: number;
  lng: number;
  at: number;
  input: "touch" | "mouse";
  compatibility: boolean;
  awaitingCompatibility: boolean;
  activationId?: number;
};

export type MarkerActivationInput = {
  lat: number;
  lng: number;
  at: number;
  pointerType?: "touch" | "mouse";
  firesTouchEvents?: boolean;
  activationId?: number;
  previous: MarkerActivation | null;
  pending: MarkerActivation | null;
};

export type ResolvedMarkerActivation = {
  activation: MarkerActivation;
  suppress: boolean;
};

const SAME_POINT_TOLERANCE = 0.00001;
const COMPATIBILITY_WINDOW_MS = 500;

export function resolveMarkerActivation(input: MarkerActivationInput): ResolvedMarkerActivation {
  const pendingPhysical =
    input.pending &&
    samePoint(input.pending, input) &&
    input.at - input.pending.at >= 0 &&
    input.at - input.pending.at <= COMPATIBILITY_WINDOW_MS
      ? input.pending
      : null;
  const explicitCompatibility = input.firesTouchEvents === true && input.pointerType !== "touch";
  const pendingIsNewPhysicalTouch = Boolean(
    pendingPhysical?.input === "touch" &&
      input.pointerType !== "mouse" &&
      (!input.previous ||
        pendingPhysical.activationId !== input.previous.activationId ||
        pendingPhysical.at > input.previous.at),
  );
  const pendingCompatibilityMouse =
    pendingPhysical?.input === "touch" && input.pointerType === "mouse";
  const inputType = input.pointerType ?? (pendingIsNewPhysicalTouch ? "touch" : pendingPhysical?.input ?? "mouse");
  const isTouch = inputType === "touch";
  const absentMetadataCompatibility =
    input.pointerType === undefined &&
    input.firesTouchEvents === undefined &&
    input.previous?.input === "touch" &&
    input.previous.awaitingCompatibility &&
    samePoint(input.previous, input) &&
    input.at - input.previous.at >= 0 &&
    input.at - input.previous.at <= COMPATIBILITY_WINDOW_MS &&
    pendingPhysical === null;
  const activation: MarkerActivation = {
    lat: input.lat,
    lng: input.lng,
    at: input.at,
    input: isTouch ? "touch" : "mouse",
    compatibility:
      !isTouch &&
      (explicitCompatibility || absentMetadataCompatibility || pendingCompatibilityMouse),
    awaitingCompatibility: isTouch,
    activationId: pendingPhysical?.activationId ?? input.activationId,
  };

  return {
    activation,
    suppress:
      !pendingIsNewPhysicalTouch &&
      shouldSuppressCompatibilityActivation(input.previous, activation),
  };
}

export function shouldSuppressCompatibilityActivation(
  previous: MarkerActivation | null,
  current: MarkerActivation,
): boolean {
  if (!previous || previous.input !== "touch" || !current.compatibility) return false;

  const samePoint =
    Math.abs(previous.lat - current.lat) < SAME_POINT_TOLERANCE &&
    Math.abs(previous.lng - current.lng) < SAME_POINT_TOLERANCE;
  const elapsed = current.at - previous.at;

  return samePoint && elapsed >= 0 && elapsed <= COMPATIBILITY_WINDOW_MS;
}

function samePoint(first: { lat: number; lng: number }, second: { lat: number; lng: number }): boolean {
  return (
    Math.abs(first.lat - second.lat) < SAME_POINT_TOLERANCE &&
    Math.abs(first.lng - second.lng) < SAME_POINT_TOLERANCE
  );
}
