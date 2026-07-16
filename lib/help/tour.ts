import { driver } from "driver.js";
import "driver.js/dist/driver.css";

import type { TourStep } from "./guides";

/**
 * Start a driver.js spotlight tour. Steps whose CSS selector matches nothing are
 * dropped first, so conditional or not-yet-rendered UI never breaks the tour.
 * Steps without an `element` render as centered modal steps.
 * Returns false (and calls onDone) when nothing runnable remains.
 */
export function startTour(steps: TourStep[], opts?: { onDone?: () => void }): boolean {
  const runnable = steps.filter((step) => {
    if (!step.element) return true;
    try {
      return document.querySelector(step.element) !== null;
    } catch {
      return false;
    }
  });

  if (runnable.length === 0) {
    opts?.onDone?.();
    return false;
  }

  const driverObj = driver({
    showProgress: runnable.length > 1,
    allowClose: true,
    overlayColor: "rgba(2, 6, 23, 0.6)",
    stagePadding: 6,
    stageRadius: 10,
    popoverClass: "vsu-tour",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    steps: runnable.map((step) => ({
      element: step.element,
      popover: {
        title: step.title,
        description: step.description,
      },
    })),
    onDestroyed: () => {
      opts?.onDone?.();
    },
  });

  driverObj.drive();
  return true;
}
