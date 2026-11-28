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

/**
 * Shape of the MapLibre "error" event we inspect. Kept structural so the
 * predicate stays a pure function that unit tests can exercise without a map.
 */
export type MapStyleErrorEvent = {
  error?: { url?: unknown; message?: unknown } | null;
  sourceId?: unknown;
};

/**
 * True only when a MapLibre error means the *initial vector style document*
 * could not be fetched, so the caller should drop the vector layer and use the
 * raster basemap instead.
 *
 * Late tile/source failures, sprite/glyph failures, and anything that arrives
 * after the style has loaded stay on the vector basemap.
 */
export function isInitialVectorStyleError(
  event: MapStyleErrorEvent | null | undefined,
  styleUrl: string,
  state: { initialStyleLoaded: boolean; hasStyle: boolean },
): boolean {
  if (state.initialStyleLoaded) return false;
  if (typeof event?.sourceId === "string" && event.sourceId.length > 0) return false;
  const errorUrl = typeof event?.error?.url === "string" ? event.error.url : null;
  if (errorUrl !== null) {
    return errorUrl === styleUrl;
  }
  return !state.hasStyle;
}
