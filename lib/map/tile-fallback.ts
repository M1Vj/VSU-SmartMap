export const DEFAULT_TILE_FALLBACK_ERROR_THRESHOLD = 3;

export type TileFallbackState = {
  errorCount: number;
  active: boolean;
  threshold: number;
};

export function createTileFallbackState(
  threshold = DEFAULT_TILE_FALLBACK_ERROR_THRESHOLD,
): TileFallbackState {
  const normalizedThreshold = Number.isFinite(threshold) && threshold > 0
    ? Math.floor(threshold)
    : DEFAULT_TILE_FALLBACK_ERROR_THRESHOLD;

  return { errorCount: 0, active: false, threshold: normalizedThreshold };
}

export function recordTileError(state: TileFallbackState): TileFallbackState {
  if (state.active) return state;

  const errorCount = state.errorCount + 1;
  return {
    ...state,
    errorCount,
    active: errorCount >= state.threshold,
  };
}
