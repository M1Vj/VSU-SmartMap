type FrameCallback = () => void;

export type MapViewportSyncScheduler = {
  schedule: (invalidateSize?: boolean) => void;
  dispose: () => void;
};

type MapViewportSyncSchedulerOptions = {
  requestFrame: (callback: FrameCallback) => number;
  cancelFrame: (frameId: number) => void;
  invalidateSize: () => void;
  resize: () => void;
  repaint: () => void;
};

export function createMapViewportSyncScheduler({
  requestFrame,
  cancelFrame,
  invalidateSize,
  resize,
  repaint,
}: MapViewportSyncSchedulerOptions): MapViewportSyncScheduler {
  let frameId: number | null = null;
  let shouldInvalidateSize = false;
  let disposed = false;

  const flush = () => {
    frameId = null;
    if (disposed) return;

    const shouldResize = shouldInvalidateSize;
    shouldInvalidateSize = false;
    if (shouldResize) {
      invalidateSize();
      resize();
    }

    repaint();
  };

  return {
    schedule(invalidate = false) {
      if (disposed) return;
      shouldInvalidateSize ||= invalidate;
      if (frameId !== null) return;
      frameId = requestFrame(flush);
    },
    dispose() {
      disposed = true;
      shouldInvalidateSize = false;
      if (frameId === null) return;
      cancelFrame(frameId);
      frameId = null;
    },
  };
}
