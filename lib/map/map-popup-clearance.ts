export const DEFAULT_POPUP_TOP_PADDING = 128;
export const DEFAULT_POPUP_BOTTOM_PADDING = 248;
export const POPUP_OBSTACLE_MARGIN = 12;

export type PopupObstacleSide = "top" | "bottom";

export type PopupMapRect = {
  top: number;
  bottom: number;
  left?: number;
  right?: number;
};

export type PopupObstacleRect = PopupMapRect & {
  side: PopupObstacleSide;
  width?: number;
  height?: number;
  connected?: boolean;
  visible?: boolean;
};

export type PopupAutoPanPadding = {
  top: number;
  bottom: number;
};

type ComputePopupAutoPanPaddingOptions = {
  mapRect: PopupMapRect;
  obstacles: readonly PopupObstacleRect[];
  topPadding?: number;
  bottomPadding?: number;
  obstacleMargin?: number;
};

const finiteOrZero = (value: number) => (Number.isFinite(value) ? value : 0);

const finiteOrUndefined = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

export function isPopupObstacleUsable(
  mapRect: PopupMapRect,
  obstacle: PopupObstacleRect,
): boolean {
  if (obstacle.connected === false || obstacle.visible === false) return false;
  if (!(obstacle.bottom > mapRect.top && obstacle.top < mapRect.bottom)) return false;

  const width = finiteOrUndefined(obstacle.width);
  const height = finiteOrUndefined(obstacle.height);
  if (width !== undefined && width <= 0) return false;
  if (height !== undefined && height <= 0) return false;

  const mapLeft = finiteOrUndefined(mapRect.left);
  const mapRight = finiteOrUndefined(mapRect.right);
  const obstacleLeft = finiteOrUndefined(obstacle.left);
  const obstacleRight = finiteOrUndefined(obstacle.right);
  if (
    mapLeft !== undefined &&
    mapRight !== undefined &&
    obstacleLeft !== undefined &&
    obstacleRight !== undefined &&
    !(obstacleRight > mapLeft && obstacleLeft < mapRight)
  ) {
    return false;
  }

  return true;
}

export function computePopupAutoPanPadding({
  mapRect,
  obstacles,
  topPadding = DEFAULT_POPUP_TOP_PADDING,
  bottomPadding = DEFAULT_POPUP_BOTTOM_PADDING,
  obstacleMargin = POPUP_OBSTACLE_MARGIN,
}: ComputePopupAutoPanPaddingOptions): PopupAutoPanPadding {
  const mapTop = finiteOrZero(mapRect.top);
  const mapBottom = finiteOrZero(mapRect.bottom);
  let top = Math.max(0, finiteOrZero(topPadding));
  let bottom = Math.max(0, finiteOrZero(bottomPadding));
  const margin = Math.max(0, finiteOrZero(obstacleMargin));

  for (const obstacle of obstacles) {
    if (!isPopupObstacleUsable(mapRect, obstacle)) continue;
    if (obstacle.side === "top") {
      top = Math.max(top, Math.max(0, finiteOrZero(obstacle.bottom) - mapTop) + margin);
      continue;
    }
    bottom = Math.max(bottom, Math.max(0, mapBottom - finiteOrZero(obstacle.top)) + margin);
  }

  return { top, bottom };
}
