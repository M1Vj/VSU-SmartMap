export const CARTO_LIGHT_TILE_HOST = "https://a.basemaps.cartocdn.com";
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

export function tileFallbackUrlFromArcGis(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.hostname !== "server.arcgisonline.com") return null;

  const match = parsed.pathname.match(/\/MapServer\/tile\/(\d+)\/(\d+)\/(\d+)(?:\.[a-z0-9]+)?$/i);
  if (!match) return null;

  const [, zoom, y, x] = match;
  return `${CARTO_LIGHT_TILE_HOST}/light_all/${zoom}/${x}/${y}.png`;
}
