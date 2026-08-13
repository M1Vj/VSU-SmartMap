export type MarkerActivation = {
  lat: number;
  lng: number;
  at: number;
  input: "touch" | "mouse";
  compatibility: boolean;
  activationId?: number;
};

const SAME_POINT_TOLERANCE = 0.00001;
const COMPATIBILITY_WINDOW_MS = 500;

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
