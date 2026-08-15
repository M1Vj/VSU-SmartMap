export const DEFAULT_POPUP_TOP_PADDING = 128;
export const DEFAULT_POPUP_BOTTOM_PADDING = 248;
export const POPUP_OBSTACLE_MARGIN = 12;

export type PopupObstacleSide = "top" | "bottom";

export type PopupMapRect = {
  top: number;
  bottom: number;
};

export type PopupObstacleRect = PopupMapRect & {
  side: PopupObstacleSide;
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
    if (obstacle.side === "top") {
      top = Math.max(top, Math.max(0, finiteOrZero(obstacle.bottom) - mapTop) + margin);
      continue;
    }
    bottom = Math.max(bottom, Math.max(0, mapBottom - finiteOrZero(obstacle.top)) + margin);
  }

  return { top, bottom };
}
